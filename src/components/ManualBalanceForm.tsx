// ============================================================================
// src/components/ManualBalanceForm.tsx
// Carga manual del Balance Inicial — stable UX + leaf-only + money formatting
// ============================================================================

import React, { useState, useMemo, useEffect, useRef } from "react";

import type { Account } from "../types/AccountTypes";
import { saveInitialBalances } from "../services/initialBalanceService";
import CreateSubaccountModal from "@/components/accounts/CreateSubaccountModal";
import { getEffectiveAccountPlan } from "@/services/effectiveAccountsService";


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
}

// -------- text helpers ----------
const normalize = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function scoreMatch(target: string, query: string): number {
  const q = normalize(query || "").trim();
  if (!q) return 0;

  const t = normalize(target || "");
  if (!t) return 0;

  if (t === q) return 120;
  if (t.startsWith(q)) return 100;
  if (t.includes(` ${q}`)) return 80;
  if (t.includes(q)) return 60;
  return 0;
}

// -------- money helpers ----------
const moneyFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoneyDisplay(n: number): string {
  if (!n) return ""; // ✅ show empty instead of 0.00
  return moneyFmt.format(n);
}

// allow typing "200000", "200,000", "200000.5"
function parseMoneyInput(raw: string): number {
  const cleaned = (raw || "")
    .replace(/[^\d.,-]/g, "")  // keep digits , . -
    .replace(/,/g, "");        // en-US: commas are thousands
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// best parent guess for "Crear subcuenta"
function findBestParent(code: string, all: Account[]): Account | null {
  const c = (code || "").trim();
  if (!c) return null;

  // try exact match first (user selected an existing parent)
  const exact = all.find(a => a.code === c);
  if (exact) return exact;

  // try stripping last 2 digits repeatedly
  for (let len = c.length - 2; len >= 1; len -= 2) {
    const candidate = c.slice(0, len);
    const found = all.find(a => a.code === candidate);
    if (found) return found;
  }

  // fallback: longest prefix match
  let best: Account | null = null;
  for (const a of all) {
    if (c.startsWith(a.code)) {
      if (!best || a.code.length > best.code.length) best = a;
    }
  }
  return best;
}

export default function ManualBalanceForm({ 
  onSubmit, 
  entityId, 
  accounts,
  initialBalanceDate,
  setInitialBalanceDate,
  existingInitialBalanceTx,
}: Props) {
  const [rows, setRows] = useState<Entry[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [parentForCreation, setParentForCreation] = useState<Account | null>(null);

  const [effectiveAccounts, setEffectiveAccounts] = useState<Account[]>(accounts);

  // dropdown click-outside
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const refreshAccounts = async () => {
    let active = true;
    const plan = await getEffectiveAccountPlan(entityId);
    if (active) setEffectiveAccounts(plan.effectiveAccounts);
    return () => { active = false };
  };

  useEffect(() => {
    refreshAccounts();

    function handleClickOutside(ev: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(ev.target as Node)) {
        setOpenIndex(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [entityId]);

  // add row
  const addEmptyLine = () => {
    setRows(prev => {
      const next = [
        ...prev,
        {
          id: crypto.randomUUID(),
          account_code: "",
          account_name: "",
          debit: 0,
          credit: 0,
          date: new Date().toISOString().slice(0, 10),
        },
      ];
      setOpenIndex(next.length - 1);
      return next;
    });
  };

  const removeLine = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const updateField = (index: number, field: keyof Entry, value: string | number) => {
    setRows(prev => {
      const next = [...prev];

      // ⛔ Block manual editing of account_code once selected
      if (
        field === "account_code" &&
        next[index].account_code &&
        value !== next[index].account_code
      ) {
        return prev;
      }

      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // totals
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

  // save
  const handleSave = async () => {
    if (!isBalanced) {
      alert(`⚠ El Balance Inicial NO cuadra (D - C = ${diff.toFixed(2)})`);
      return;
    }

    if (rows.length === 0) {
      alert("No hay lineas en el Balance Inicial.");
      return;
    }

    try {
      const invalidRow = rows.find(
        r => !r.account_code || ((Number(r.debit) || 0) === 0 && (Number(r.credit) || 0) === 0)
      );
      if (invalidRow) {
        alert("⚠ Existen líneas sin cuenta o sin valores.");
        return;
      }

      // ✅ IMPORTANT: if Firestore rules require uid/userIdSafe, your service MUST store it.
      // If your saveInitialBalances() currently doesn't include userIdSafe, you'll get
      // "Missing or insufficient permissions".
      await saveInitialBalances(
        entityId,
        rows.map(r => ({
          account_code: r.account_code,
          account_name: r.account_name,
          initial_balance: (Number(r.debit) || 0) - (Number(r.credit) || 0),
          // userIdSafe: uid, // ✅ uncomment IF your service supports it
        }))
      );

      alert("✔ Balance Inicial guardado.");
      onSubmit(rows);
    } catch (err) {
      console.error(err);
      alert("❌ Error guardando Balance Inicial.");
    }
  };


  return (
    
    <div className="p-4 border rounded mb-4 relative">
      <h3 className="font-semibold mb-2">Carga Manual del Balance Inicial</h3>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">
          Fecha del Balance Inicial
        </label>

        <input
          type="date"
          value={initialBalanceDate}
          disabled={existingInitialBalanceTx}
          onChange={(e) => setInitialBalanceDate(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />

        {existingInitialBalanceTx && (
          <span className="text-xs text-gray-500">
            🔒 Fecha bloqueada
          </span>
        )}
      </div>

      <button
        type="button"
        className="mb-4 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={addEmptyLine}
      >
        ➕ Agregar Línea
      </button>

      <div className="border rounded-lg relative">
        <table className="w-full text-xs md:text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 border">Código</th>
              <th className="p-2 border">Cuenta</th>
              <th className="p-2 border text-right w-28">Débito</th>
              <th className="p-2 border text-right w-28">Crédito</th>
              <th className="p-2 border w-8">✂</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => {
              const query = (row.account_name || row.account_code || "").trim();

              const selectableAccounts = effectiveAccounts.filter(
                acc => !rows.some(r => r.account_code === acc.code)
              );

              const suggestions =
                query.length === 0
                  ? selectableAccounts.slice(0, 20)
                  : selectableAccounts
                      .map((acc: Account) => ({
                        ...acc,
                        score:
                          scoreMatch(acc.code, query) +
                          scoreMatch(acc.name, query),
                      }))
                      .filter(acc => acc.score > 0)
                      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                      .slice(0, 20);

              return (
                <tr key={row.id} className="odd:bg-white even:bg-gray-50">
                  {/* Código */}
                  <td className="border p-1">
                    <input
                      type="text"
                      value={row.account_code}
                      readOnly
                      tabIndex={-1}
                      className="w-full border rounded px-1 py-0.5 bg-gray-100 cursor-not-allowed"
                    />
                  </td>

                  {/* Cuenta */}
                  <td className="border p-1 relative">
                    <input
                      type="text"
                      placeholder="Buscar cuenta contable…"
                      value={row.account_name} // ✅ always show selected name
                      className="w-full border rounded px-1 py-0.5"
                      onFocus={() => setOpenIndex(i)}
                      onChange={e => updateField(i, "account_name", e.target.value)}
                    />

                    {openIndex === i && (
                      <div
                        ref={dropdownRef}
                        className="absolute left-0 right-0 mt-1 bg-white border rounded shadow-xl z-50 max-h-56 overflow-y-auto text-xs"
                      >
                        {suggestions.map(acc => (
                          <div
                            key={acc.code}
                            className="px-3 py-2 cursor-pointer hover:bg-blue-100"
                            onMouseDown={() => {
                              updateField(i, "account_code", acc.code);
                              updateField(i, "account_name", acc.name);
                              setOpenIndex(null);
                            }}
                          >
                            <strong>{acc.code}</strong> — {acc.name}
                          </div>
                        ))}

                        {/* CREATE SUBACCOUNT */}
                        <div
                          className="px-3 py-2 cursor-pointer text-blue-600 hover:bg-blue-50 border-t"
                          onMouseDown={() => {
                            // choose parent based on current selected code or typed account_code
                            const parent = findBestParent(row.account_code, effectiveAccounts);
                            if (!parent) {
                              alert("Seleccione primero una cuenta padre (ej: 302, 1010103, etc.).");
                              return;
                            }
                            setParentForCreation(parent);
                            setShowCreateModal(true);
                          }}
                        >
                          ➕ Crear subcuenta
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Débito */}
                  <td className="border p-1 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full border rounded px-1 py-0.5 text-right"
                      value={
                        row._debitInput !== undefined 
                          ? row._debitInput 
                          : formatMoneyDisplay(row.debit)}
                      onFocus={() => {
                        updateField(i, "_debitInput", row.debit ? String(row.debit) : "");
                      }}
                      onChange={e => {
                        updateField(i, "_debitInput", e.target.value);
                      }}
                      onBlur={() => {
                      const parsed = parseMoneyInput(row._debitInput || "");
                      setRows(prev => {
                        const next = [...prev];
                        next[i] = {
                          ...next[i],
                          debit: parsed,
                          _debitInput: undefined, // 🔥 clear buffer
                        };
                        return next;
                      });
                    }}
                    />
                  </td>

                  {/* Crédito */}
                  <td className="border p-1 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full border rounded px-1 py-0.5 text-right"
                      value={
                        row._creditInput !== undefined
                          ? row._creditInput
                          : formatMoneyDisplay(row.credit)
                      }
                      onFocus={() => {
                        updateField(i, "_creditInput", row.credit ? String(row.credit) : "");
                      }}
                      onChange={e => {
                        updateField(i, "_creditInput", e.target.value);
                      }}
                      onBlur={() => {
                        const parsed = parseMoneyInput(row._creditInput || "");
                        setRows(prev => {
                          const next = [...prev];
                          next[i] = {
                            ...next[i],
                            credit: parsed,
                            _creditInput: undefined,
                          };
                          return next;
                        });
                      }}
                    />
                  </td>

                  {/* Delete */}
                  <td className="border p-1 text-center">
                    <button className="text-red-600 hover:text-red-800" onClick={() => removeLine(row.id)}>
                      ✖
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* Totals */}
            {rows.length > 0 && (
              <tr className="bg-gray-100 font-semibold">
                <td className="border p-2 text-right" colSpan={2}>
                  Totales:
                </td>
                <td className="border p-2 text-right">{moneyFmt.format(totalDebit)}</td>
                <td className="border p-2 text-right">{moneyFmt.format(totalCredit)}</td>
                <td className="border" />
              </tr>
            )}
          </tbody>
        </table>
      </div>


      <div className="mt-4 flex justify-end">
        <button
          className={`px-4 py-2 rounded text-white ${
            isBalanced ? "bg-green-600 hover:bg-green-700" : "bg-green-600/40 cursor-not-allowed"
          }`}
          disabled={!isBalanced}
          onClick={handleSave}
        >
          Confirmar Balance Inicial
        </button>
      </div>


      <div className="mt-2 text-sm">
        {isBalanced ? (
          <span className="text-green-700">✔ Balanceado</span>
        ) : (
          <span className="text-red-600">⚠ No balanceado (D - C = {diff.toFixed(2)})</span>
        )}
      </div>

      {parentForCreation && (
        <CreateSubaccountModal
          entityId={entityId}
          parentAccount={parentForCreation}
          existingAccounts={effectiveAccounts}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={async (newAccount) => {
            await refreshAccounts();

            // Auto-select newly created leaf on the open row
            setRows(prev => {
              const next = [...prev];
              const idx = openIndex;
              if (idx !== null) {
                next[idx] = {
                  ...next[idx],
                  account_code: newAccount.code,
                  account_name: newAccount.name,
                };
              }
              return next;
            });

            setShowCreateModal(false);
            setOpenIndex(null);
          }}
        />
      )}
    </div>
  );
}