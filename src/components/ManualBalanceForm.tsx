// ============================================================================
// src/components/ManualBalanceForm.tsx
// CONTILISTO — Manual Initial Balance Form (FINAL STABLE VERSION)
// FIXES:
// - React hooks rule violation FIXED
// - Account picker stable
// - Editable debit/credit inputs FIXED
// - Better suggestions ranking
// ============================================================================

import React, { useState, useMemo, useEffect, useRef } from "react";

import type { Account } from "../types/AccountTypes";
import CreateSubaccountModal from "@/components/accounts/CreateSubaccountModal";
import { getEffectiveAccountPlan } from "@/services/effectiveAccountsService";
import { JournalEntry } from "@/types/JournalEntry";

export interface Entry {
  id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  _debitInput?: string;
  _creditInput?: string;
  date: string;
}

interface Props {
  onSubmit: (entries: Entry[]) => void;
  entityId: string;
  accounts: Account[];
  initialBalanceDate: string;
  setInitialBalanceDate: (date: string) => void;
  existingInitialBalanceTx: boolean;
  initialData?: JournalEntry[];
}

// ---------------- TEXT HELPERS ----------------
const normalize = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function scoreMatch(target: string, query: string): number {
  const t = normalize(target || "");
  const q = normalize(query || "").trim();

  if (!q) return 0;

  const words = q.split(/\s+/);

  let score = 0;

  for (const w of words) {
    if (t.includes(w)) score += 50;
    else if (t.startsWith(w)) score += 80;
  }

  if (t === q) score += 100;

  return score;
}

// ---------------- MONEY HELPERS ----------------
const moneyFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoneyDisplay(n: number): string {
  if (!n) return "";
  return moneyFmt.format(n);
}

function parseMoneyInput(raw: string): number {
  const cleaned = (raw || "")
    .replace(/[^\d.,-]/g, "")
    .replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// ---------------- COMPONENT ----------------
export default function ManualBalanceForm({
  onSubmit,
  entityId,
  accounts,
  initialBalanceDate,
  setInitialBalanceDate,
  existingInitialBalanceTx,
  initialData,
}: Props) {
  const [rows, setRows] = useState<Entry[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [parentForCreation, setParentForCreation] = useState<Account | null>(null);
  const [effectiveAccounts, setEffectiveAccounts] = useState<Account[]>(accounts);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // ✅ FIX: Memo OUTSIDE map (CRITICAL)
  const accountIndex = useMemo(() => effectiveAccounts, [effectiveAccounts]);

  // ---------------- LOAD ACCOUNTS ----------------
  const refreshAccounts = async () => {
    const plan = await getEffectiveAccountPlan(entityId);
    setEffectiveAccounts(plan.effectiveAccounts);
  };

  useEffect(() => {
    refreshAccounts();

    const handleClickOutside = (ev: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(ev.target as Node)
      ) {
        setOpenIndex(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [entityId]);

  // ---------------- LOAD INITIAL DATA ----------------
  useEffect(() => {
    if (!initialData || initialData.length === 0) return;

    setRows(
      initialData.map((e) => ({
        id: crypto.randomUUID(),
        account_code: e.account_code,
        account_name: e.account_name,
        debit: Number(e.debit || 0),
        credit: Number(e.credit || 0),
        date: e.date || new Date().toISOString().slice(0, 10),
      }))
    );
  }, [initialData]);

  // ---------------- ADD / REMOVE ----------------
  const addEmptyLine = () => {
    setRows((prev) => {
      const next = [
        ...prev,
        {
          id: crypto.randomUUID(),
          account_code: "",
          account_name: "",
          debit: 0,
          credit: 0,
          date: initialBalanceDate,
        },
      ];
      setOpenIndex(next.length - 1);
      return next;
    });
  };

  const removeLine = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // ---------------- UPDATE ----------------
  const updateField = (
    index: number,
    field: keyof Entry,
    value: string | number
  ) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // ---------------- TOTALS ----------------
  const { totalDebit, totalCredit, isBalanced, diff } = useMemo(() => {
    const d = rows.reduce((s, r) => s + (Number(r.debit) || 0), 0);
    const c = rows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
    return {
      totalDebit: d,
      totalCredit: c,
      isBalanced: Math.abs(d - c) < 0.001,
      diff: d - c,
    };
  }, [rows]);

  // ---------------- SAVE ----------------
  const handleSave = () => {
    if (rows.length < 2) {
      alert("El Balance Inicial debe tener al menos 2 líneas.");
      return;
    }

    if (!isBalanced) {
      alert(`⚠ No cuadra (D - C = ${diff.toFixed(2)})`);
      return;
    }

    const invalid = rows.find(
      (r) =>
        !r.account_code ||
        ((Number(r.debit) || 0) === 0 &&
          (Number(r.credit) || 0) === 0)
    );

    if (invalid) {
      alert("⚠ Todas las líneas deben tener cuenta y valor.");
      return;
    }

    onSubmit(rows);
  };

  // ---------------- RENDER ----------------
  return (
    <div className="p-4 border rounded mb-4">
      <h3 className="font-semibold mb-2">
        Carga Manual del Balance Inicial
      </h3>

      {/* DATE */}
      <div className="flex items-center gap-3 mb-3">
        <label className="text-sm font-medium">Fecha</label>
        <input
          type="date"
          value={initialBalanceDate}
          disabled={existingInitialBalanceTx && !initialData}
          onChange={(e) => setInitialBalanceDate(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
      </div>

      {/* ADD */}
      <button
        className="mb-4 px-3 py-2 bg-blue-600 text-white rounded"
        onClick={addEmptyLine}
      >
        ➕ Agregar Línea
      </button>

      {/* TABLE */}
      <table className="w-full text-sm border">
        <thead className="bg-gray-200 text-xs uppercase">
          <tr>
            <th className="px-3 py-2 w-[140px]">Código</th>
            <th className="px-3 py-2">Cuenta</th>
            <th className="px-3 py-2 w-[140px]">Débito</th>
            <th className="px-3 py-2 w-[140px]">Crédito</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i) => {
            const query = (row.account_name || row.account_code || "").trim();

            const suggestions = accountIndex
              .map((acc) => ({
                ...acc,
                score:
                  scoreMatch(acc.code, query) +
                  scoreMatch(acc.name, query) * 2,
              }))
              .filter((acc) => (query ? acc.score > 0 : true))
              .sort((a, b) => b.score - a.score)
              .slice(0, 20);

            return (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2 font-mono">{row.account_code}</td>

                {/* ACCOUNT PICKER */}
                <td className="relative px-3 py-2">
                  <input
                    className="w-full border rounded px-2 py-1"
                    value={row.account_name}
                    onFocus={() => setOpenIndex(i)}
                    onChange={(e) => {
                      updateField(i, "account_name", e.target.value);
                      setOpenIndex(i);
                    }}
                  />

                  {openIndex === i && suggestions.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute z-50 bg-white border w-full max-h-60 overflow-auto shadow-lg"
                    >
                      {suggestions.map((acc) => (
                        <div
                          key={acc.code}
                          className="px-3 py-2 hover:bg-blue-100 cursor-pointer"
                          onMouseDown={() => {
                            updateField(i, "account_code", acc.code);
                            updateField(i, "account_name", acc.name);
                            setOpenIndex(null);
                          }}
                        >
                          {acc.code} - {acc.name}
                        </div>
                      ))}
                    </div>
                  )}
                </td>

                {/* DEBIT */}
                <td className="px-3 py-2 text-right">
                  <input
                    className="text-right w-full"
                    value={
                      row._debitInput !== undefined
                        ? row._debitInput
                        : row.debit
                        ? formatMoneyDisplay(row.debit)
                        : ""
                    }
                    onFocus={() => {
                      updateField(
                        i,
                        "_debitInput",
                        row.debit ? String(row.debit) : ""
                      );
                    }}
                    onChange={(e) =>
                      updateField(i, "_debitInput", e.target.value)
                    }
                    onBlur={() => {
                      const val = parseMoneyInput(row._debitInput || "");
                      setRows((prev) => {
                        const next = [...prev];
                        next[i] = {
                          ...next[i],
                          debit: val,
                          credit: 0,
                          _debitInput: undefined,
                        };
                        return next;
                      });
                    }}
                  />
                </td>

                {/* CREDIT */}
                <td className="px-3 py-2 text-right">
                  <input
                    className="text-right w-full"
                    value={
                      row._creditInput !== undefined
                        ? row._creditInput
                        : row.credit
                        ? formatMoneyDisplay(row.credit)
                        : ""
                    }
                    onFocus={() => {
                      updateField(
                        i,
                        "_creditInput",
                        row.credit ? String(row.credit) : ""
                      );
                    }}
                    onChange={(e) =>
                      updateField(i, "_creditInput", e.target.value)
                    }
                    onBlur={() => {
                      const val = parseMoneyInput(row._creditInput || "");
                      setRows((prev) => {
                        const next = [...prev];
                        next[i] = {
                          ...next[i],
                          credit: val,
                          debit: 0,
                          _creditInput: undefined,
                        };
                        return next;
                      });
                    }}
                  />
                </td>

                <td className="text-center">
                  <button onClick={() => removeLine(row.id)}>✖</button>
                </td>
              </tr>
            );
          })}

          {/* TOTALS */}
          {rows.length > 0 && (
            <tr className="bg-gray-100 font-semibold border-t-2">
              <td />
              <td className="text-center">Totales:</td>
              <td className="text-right">{moneyFmt.format(totalDebit)}</td>
              <td className="text-right">{moneyFmt.format(totalCredit)}</td>
              <td />
            </tr>
          )}
        </tbody>
      </table>

      {/* STATUS */}
      <div className="mt-2">
        {isBalanced ? (
          <span className="text-green-600">✔ Balanceado</span>
        ) : (
          <span className="text-red-600">
            ⚠ Diferencia: {diff.toFixed(2)}
          </span>
        )}
      </div>

      {/* SAVE */}
      <div className="mt-4 text-right">
        <button
          disabled={!isBalanced}
          onClick={handleSave}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Confirmar Balance Inicial
        </button>
      </div>
    </div>
  );
}