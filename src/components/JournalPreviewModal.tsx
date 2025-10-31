// src/components/JournalPreviewModal.tsx

import React, { useEffect, useMemo, useState, useCallback } from "react";
import type { Account } from "../types/AccountTypes";
import type { JournalEntry } from "../types/JournalEntry";
import AccountPicker from "./AccountPicker";
import { saveAccountHint } from "../services/aiLearningService";
import { Rnd } from "react-rnd";
import {
  canonicalCodeFrom,
  canonicalPair,
  normalizeEntry,
} from "../utils/accountPUCMap";

interface Props {
  entries?: JournalEntry[];
  accounts: Account[];
  entityId: string;
  userId: string;
  onClose: () => void;
  onSave: (withNote: JournalEntry[], note: string) => Promise<void>;
}

type Row = JournalEntry & { _rid: string };

function extractLeadingCodeFromLabel(label?: string): string | null {
  if (!label) return null;
  const m = label.trim().match(/^(\d{2,})\s*[—-]\s*/);
  return m ? m[1] : null;
}

function toNum(n: unknown): number | undefined {
  const v = typeof n === "string" ? Number.parseFloat(n) : (n as number | undefined);
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function rid(): string {
  if (typeof crypto?.getRandomValues === "function") {
    const a = new Uint32Array(2);
    crypto.getRandomValues(a);
    return `${a[0].toString(36)}-${a[1].toString(36)}`;
  }
  return Math.random().toString(36).slice(2);
}

export default function JournalPreviewModal({
  entries = [],
  accounts,
  entityId,
  userId,
  onClose,
  onSave,
}: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [note, setNote] = useState<string>(() => {
    const inv = entries.find((e) => e.invoice_number)?.invoice_number;
    return inv ? `Factura No. ${inv}` : "";
  });
  const [isSaving, setIsSaving] = useState(false);

  const codeToName = useMemo(() => {
    const m = new Map<string, string>();
    accounts.forEach((a) => m.set(a.code, a.name));
    return m;
  }, [accounts]);

  const inferCodeFromName = (name?: string): string | "" => {
    if (!name) return "";
    const fromLabel = extractLeadingCodeFromLabel(name);
    const candidate = fromLabel || name;
    return canonicalCodeFrom(candidate) || "";
  };

  useEffect(() => {
    const updated: Row[] = entries.map((e) => {
      let u: JournalEntry = { ...e };

      if (u.type === "income" && u.account_code === "11101" && u.account_name === "Caja") {
        u.account_code = "14301";
        u.account_name = "Cuentas por cobrar comerciales locales";
        u.description = "Cuenta por cobrar por factura de venta";
      }

      if (u.type === "income" && u.account_code === "70101" && (u.debit ?? 0) > 0) {
        u.credit = u.debit;
        u.debit = undefined;
      }

      u = normalizeEntry(u);

      if (!u.account_code && u.account_name) {
        const code = inferCodeFromName(u.account_name);
        if (code) {
          u.account_code = code;
          u.account_name = codeToName.get(code) || u.account_name;
        }
      }

      if (u.account_code && !u.account_name) {
        const nm = codeToName.get(u.account_code);
        if (nm) u.account_name = nm;
      }

      return {
        ...u,
        source: u.source ?? "ai",
        entityId,
        _rid: rid(),
      };
    });

    setRows(updated);
  }, [entries, codeToName, entityId]);

  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + (toNum(r.debit) ?? 0), 0);
    const credit = rows.reduce((s, r) => s + (toNum(r.credit) ?? 0), 0);
    const diff = +(debit - credit).toFixed(2);
    return { debit: +debit.toFixed(2), credit: +credit.toFixed(2), diff };
  }, [rows]);

  const isBalanced = Math.abs(totals.diff) < 0.01;
  const canConfirm = totals.debit > 0 && totals.credit > 0 && isBalanced;

  const patchRow = (idx: number, patch: Partial<JournalEntry>) => {
    setRows((prev) => {
      const next = [...prev];
      const cur = next[idx];
      const merged = { ...cur, ...patch };
      const canon = normalizeEntry({ 
        account_code: merged.account_code, 
        account_name: merged.account_name 
      });

      next[idx] = {
        ...merged,
        account_code: canon.account_code,
        account_name: canon.account_name,
        isManual: true,
        source: cur.source === "ai" ? "edited" : cur.source,
        editedAt: Date.now(),
        editedBy: userId,
        entityId,
      };
      return next;
    });
  };

  const setAmount = (idx: number, field: "debit" | "credit", raw: string) => {
    const val = raw.trim() === "" ? undefined : Number.parseFloat(raw);
    if (field === "debit") {
      patchRow(idx, { 
        debit: Number.isFinite(val as number) ? (val as number) : undefined, 
        credit: undefined 
      });
    } else {
      patchRow(idx, { 
        credit: Number.isFinite(val as number) ? (val as number) : undefined, 
        debit: undefined 
      });
    }
  };

  const setDescription = (idx: number, description: string) => {
    patchRow(idx, { description });
  };

  const setDate = (idx: number, date: string) => {
    patchRow(idx, { date });
  };

  const applyCode = (idx: number, code: string) => {
    const name = codeToName.get(code) ?? "";
    patchRow(idx, { account_code: code || "", account_name: name || "" });
  };

  const applyAccount = (idx: number, acc: { code: string; name: string } | null) => {
    if (!acc) return;
    const canon = canonicalPair(acc);
    patchRow(idx, { account_code: canon.code || "", account_name: canon.name || "" });
  };

  const insertLine = (after?: number) => {
    const base = rows[0] ?? entries[0];
    const nl: Row = {
      _rid: rid(),
      date: base?.date ?? new Date().toISOString().slice(0, 10),
      description: "",
      account_code: "",
      account_name: "",
      debit: undefined,
      credit: undefined,
      type: base?.type,
      invoice_number: base?.invoice_number,
      transactionId: base?.transactionId,
      userId,
      source: "manual",
      isManual: true,
      createdAt: Date.now(),
      entityId,
    };
    setRows((prev) => {
      const next = [...prev];
      const pos = typeof after === "number" ? after + 1 : next.length;
      next.splice(pos, 0, nl);
      return next;
    });
    setSelectedIdx((after ?? rows.length - 1) + 1);
  };

  const duplicateSelected = () => {
    if (selectedIdx == null) return;
    const src = rows[selectedIdx];
    setRows((prev) => {
      const next = [...prev];
      next.splice(selectedIdx + 1, 0, {
        ...src,
        _rid: rid(),
        isManual: true,
        source: "edited",
        editedAt: Date.now(),
        editedBy: userId,
      });
      return next;
    });
    setSelectedIdx(selectedIdx + 1);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    if (selectedIdx === idx) setSelectedIdx(null);
  };

  const learnFromEdits = async (confirmed: JournalEntry[]) => {
    const hints = confirmed.filter((r) => r.isManual || r.source === "edited");
    await Promise.all(
      hints.map((h) =>
        saveAccountHint({
          entityId,
          userId,
          hintKey: h.counterpartyRUC || h.invoice_number || h.description || "general",
          account_code: h.account_code,
          account_name: h.account_name,
          type: h.type,
        }).catch(() => void 0)
      )
    );
  };

  const handleConfirm = useCallback(async () => {
  if (!canConfirm || isSaving) return;

  // Forzar blur para confirmar último input activo
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  setIsSaving(true);

  try {
    const finalEntries: JournalEntry[] = rows.map((r) => ({
    ...r,
    description: r.description?.trim() ? r.description : note || r.description,
    userId,
    entityId,
    editedAt: r.isManual ? Date.now() : r.editedAt ?? Date.now(),
  }));

    console.log("✅ Guardando asientos desde JournalPreviewModal:", finalEntries, length);

    await learnFromEdits(finalEntries);

    await onSave(finalEntries, note);

  } catch (error) {
    console.error("❌ Error al confirmar asiento:", error);
    alert("Error al guardar los asientos contables.");
    setIsSaving(false);
  }
}, [rows, note, userId, entityId, canConfirm, isSaving, onSave]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <Rnd
        default={{
          x: window.innerWidth / 2 - 500,
          y: window.innerHeight / 2 - 300,
          width: 1000,
          height: "auto",
        }}
        bounds="window"
        minWidth={800}
        dragHandleClassName="drag-header"
        enableResizing={false}
        className="bg-white rounded-xl shadow-xl border border-gray-300"
      >
        <div className="bg-white rounded-xl shadow-lg w-full p-6 mx-4">
          <div className="drag-header cursor-move mb-4 border-b pb-3 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">
              🧾 Previsualización de Asientos Contables
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => insertLine(selectedIdx ?? undefined)} 
                className="rounded bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700"
                disabled={isSaving}
              >
                ➕ Agregar línea
              </button>
              <button 
                onClick={duplicateSelected} 
                disabled={selectedIdx == null} 
                className="rounded bg-indigo-600 px-3 py-1 text-white enabled:hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ⧉ Duplicar
              </button>
              <button 
                onClick={() => (selectedIdx == null ? null : removeRow(selectedIdx))} 
                disabled={selectedIdx == null} 
                className="rounded bg-rose-600 px-3 py-1 text-white enabled:hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ✖ Eliminar
              </button>
            </div>
          </div>

          <div className="mb-3">
            <input 
              className="w-full rounded border px-3 py-3 text-slate-700" 
              placeholder="Ej: Factura No. XXX-XXX-000123, ajuste por depreciación, reclasificación, etc." 
              aria-label="Anotación del asiento (opcional)" 
              value={note} 
              onChange={(e) => setNote(e.target.value)}
              disabled={isSaving} 
            />
          </div>

          <div className="max-h-[60vh] overflow-auto rounded border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
                <tr className="border-b">
                  <th className="border p-2 w-[220px]">Código</th>
                  <th className="border p-2 min-w-[520px]">Cuenta</th>
                  <th className="border p-2 text-right w-[140px]">Débito</th>
                  <th className="border p-2 text-right w-[140px]">Crédito</th>
                  <th className="border p-2 w-[60px]" aria-label="acciones" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const selected = selectedIdx === idx;
                  const codeValue = canonicalCodeFrom(r.account_code || r.account_name || "") || inferCodeFromName(r.account_name) || "";
                  return (
                    <tr 
                      key={r._rid} 
                      className={`border-t ${selected ? "bg-emerald-50" : "hover:bg-slate-50"}`} 
                      onClick={() => setSelectedIdx(idx)}
                    >
                      <td className="border p-2">
                        <select 
                          className="w-full rounded border px-2 py-2" 
                          value={codeValue} 
                          onChange={(e) => applyCode(idx, e.target.value)}
                          disabled={isSaving}
                        >
                          <option value="">-- Seleccionar --</option>
                          {accounts.map((a) => (
                            <option key={a.code} value={a.code}>{a.code}</option>
                          ))}
                        </select>
                      </td>
                      <td className="border p-2">
                        {isSaving ? (
                          <input
                            type="text"
                            className="w-full rounded border px-2 py-2 text-sm bg-gray-50"
                            value={codeToName.get(codeValue) ?? r.account_name}
                            disabled
                          />
                      ) : (
                        <AccountPicker 
                          accounts={accounts} 
                          value={codeValue ? { code: codeValue, name: codeToName.get(codeValue) ?? r.account_name } : null} 
                          onChange={(acc) => applyAccount(idx, acc)} 
                          placeholder="Buscar cuenta por nombre o código…" 
                          displayMode="name" 
                          inputClassName="w-full rounded border px-2 py-2" 
                        />
                      )}
                    </td>
                    <td className="border p-2">
                      <input
                        inputMode="decimal" 
                        type="number" 
                        step="0.01" 
                        className="w-full rounded border px-2 py-2 text-right text-sm" 
                        value={r.debit ?? ""} 
                        onChange={(ev) => setAmount(idx, "debit", ev.target.value)} 
                      />
                      </td>
                      <td className="border p-2 text-right">
                        <input 
                          inputMode="decimal" 
                          type="number" 
                          step="0.01" 
                          className="w-full rounded border px-2 py-2 text-right text-sm" 
                          value={r.credit ?? ""} 
                          onChange={(ev) => setAmount(idx, "credit", ev.target.value)}
                          disabled={isSaving}
                        />
                      </td>
                      <td className="border p-2 text-center">
                        <button 
                          className="rounded bg-rose-600 px-2 py-1 text-white hover:bg-rose-700" 
                          onClick={() => removeRow(idx)}
                          disabled={isSaving}
                        >
                          ✖
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-medium">
                  <td className="border p-2" colSpan={2}>Totales</td>
                  <td className="border p-2 text-right">{totals.debit.toFixed(2)}</td>
                  <td className="border p-2 text-right">{totals.credit.toFixed(2)}</td>
                  <td className="border p-2 text-center">
                    {isBalanced ? (
                      <span className="text-emerald-700">Asiento balanceado</span>
                    ) : (
                      <span className="text-rose-700">Dif: {totals.diff.toFixed(2)}</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <button 
              onClick={onClose} 
              className="rounded bg-slate-200 px-4 py-2 text-slate-800 hover:bg-slate-300"
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button 
              onClick={handleConfirm} 
              disabled={!canConfirm || isSaving} 
              className={`rounded px-4 py-2 text-white ${
                canConfirm && !isSaving
                  ? "bg-blue-600 hover:bg-blue-700" 
                  : "bg-blue-300 cursor-not-allowed"
                }`}
              >
              {isSaving ? "Guardando..." : "  ✅ Confirmar Asientos"}
            </button>
          </div>
        </div>
      </Rnd>
    </div>
  );
}