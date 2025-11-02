// src/components/ManualEntryModal.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Rnd } from "react-rnd";
import { v4 as uuidv4 } from "uuid";
import { saveJournalEntries } from "../services/journalService";
import type { Account } from "../types/AccountTypes";
import type { JournalEntry } from "../types/JournalEntry";
import AccountPicker from "./AccountPicker";
import { canonicalCodeFrom, canonicalPair, normalizeEntry } from "../utils/accountPUCMap";

interface Props {
  entityId: string;
  userId: string;
  accounts: Account[];
  onClose: () => void;
  onAddEntries: (entries: JournalEntry[]) => Promise<void>;
}

/**
 * ✅ ManualEntryModal with full editing capabilities
 * - Manual editing of all fields (date, code, account, description, amounts)
 * - onAddEntries is async and parent handles refresh
 * - Matches JournalPreviewModal functionality
 */

export default function ManualEntryModal({ 
  entityId, 
  userId, 
  accounts, 
  onClose, 
  onAddEntries 
}: Props) {
  const [rows, setRows] = useState<JournalEntry[]>([createEmptyRow(), createEmptyRow()]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  function createEmptyRow(): JournalEntry {
    return {
      id: uuidv4(),
      account_code: "",
      account_name: "",
      debit: undefined,
      credit: undefined,
      description: "",
      entityId,
      userId,
      date: new Date().toISOString().slice(0, 10),
      source: "manual",
      isManual: true,
      createdAt: Date.now(),
    };
  }

  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + (r.debit || 0), 0);
    const credit = rows.reduce((s, r) => s + (r.credit || 0), 0);
    const diff = +(debit - credit).toFixed(2);
    return { debit: +debit.toFixed(2), credit: +credit.toFixed(2), diff };
  }, [rows]);

  const isBalanced = Math.abs(totals.diff) < 0.01 && totals.debit > 0 && totals.credit > 0;

  const patchRow = (idx: number, patch: Partial<JournalEntry>) => {
    setRows((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };
      const canon = normalizeEntry({ 
        account_code: merged.account_code, 
        account_name: merged.account_name 
      });
      next[idx] = {
        ...merged,
        account_code: canon.account_code,
        account_name: canon.account_name,
      };
      return next;
    });
  };

  const applyCode = (idx: number, code: string) => {
    const name = accounts.find((a) => a.code === code)?.name ?? "";
    patchRow(idx, { account_code: code || "", account_name: name || "" });
  };

  const applyAccount = (idx: number, acc: { code: string; name: string } | null) => {
    if (!acc) return;
    const canon = canonicalPair(acc);
    patchRow(idx, { account_code: canon.code || "", account_name: canon.name || "" });
  };

  const setAmount = (idx: number, field: "debit" | "credit", raw: string) => {
    const val = raw.trim() === "" ? undefined : Number.parseFloat(raw);
    if (field === "debit") {
      patchRow(idx, { debit: val, credit: undefined });
    } else {
      patchRow(idx, { credit: val, debit: undefined });
    }
  };

  const setDescription = (idx: number, description: string) => {
    patchRow(idx, { description });
  };

  const addRow = () => setRows([...rows, createEmptyRow()]);

  const duplicateRow = () => {
    if (selectedIdx == null) return;
    const copy = { ...rows[selectedIdx], id: uuidv4() };
    setRows((prev) => {
      const next = [...prev];
      next.splice(selectedIdx + 1, 0, copy);
      return next;
    });
    setSelectedIdx(selectedIdx + 1);
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
    if (selectedIdx === idx) setSelectedIdx(null);
  };

  /**
   * - Guarda en Firestore
   * - Llama a onAddEntries (padre maneja refresh)
   * - Cierra modal
   */
  const handleSave = async () => {

    const invalidAccounts = rows.filter(r => (r.account_code?.length ?? 0) < 7);
    if (invalidAccounts.length > 0) {
      alert("❌ Solo se pueden usar cuentas de nivel 4 o superior (códigos con al menos 7 dígitos).");
      return;
    }

    if (!isBalanced || isSaving) return;

    setIsSaving(true);

    try {
      const withMeta = rows.map((r) => ({ 
        ...r, 
        userId, 
        entityId,
        createdAt: Date.now(),
      }));

      console.log("✍️ Guardando asientos manuales:", withMeta.length);

      await saveJournalEntries(entityId, withMeta, userId);
      await onAddEntries(withMeta);

      onClose();
    } catch (err) {
      console.error("❌ Error al guardar asientos manuales:", err);
      alert("Error al guardar los asientos. Por favor intenta de nuevo.");
      setIsSaving(false);
    }
  };

  // Close on click outside
  // Close on click outside, but not when clicking AccountPicker dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Don't close if clicking inside the modal
      if (modalRef.current && !modalRef.current.contains(target)) {
        // Don't close if clicking on AccountPicker dropdown (it renders in a portal)
        const isAccountPickerDropdown = target.closest('[role="listbox"]') || 
                                       target.closest('.account-picker-dropdown') ||
                                       target.closest('[data-account-picker]');
        
        if (!isAccountPickerDropdown && !isSaving) {
          onClose();
        }
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, isSaving]);

  return createPortal(
    <div 
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
      onClick={(e) => {
        // Only close if clicking directly on the backdrop (not on modal content)
        if (e.target === e.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <Rnd
        default={{ 
          x: window.innerWidth / 2 - 600, 
          y: window.innerHeight / 2 - 350, 
          width: 1200, 
          height: "auto" 
        }}
        bounds="window"
        minWidth={1000}
        dragHandleClassName="drag-header"
        enableResizing={false}
        className="bg-white rounded-xl shadow-xl border border-gray-300"
      >
        <div ref={modalRef} className="bg-white rounded-xl shadow-lg w-full p-6 mx-4">
          <div className="drag-header cursor-move mb-4 border-b pb-3 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">
              ✍ Ingreso manual de asiento contable
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={addRow} 
                disabled={isSaving}
                className="rounded bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                ➕ Agregar línea
              </button>
              <button 
                onClick={duplicateRow} 
                disabled={selectedIdx == null || isSaving} 
                className="rounded bg-indigo-600 px-3 py-1 text-white enabled:hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ⧉ Duplicar
              </button>
              <button 
                onClick={() => (selectedIdx == null ? null : removeRow(selectedIdx))} 
                disabled={selectedIdx == null || rows.length <= 1 || isSaving} 
                className="rounded bg-rose-600 px-3 py-1 text-white enabled:hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ✖ Eliminar
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🗓 Fecha del asiento
              </label>
              <input
                type="date"
                className="w-full rounded border px-3 py-2"
                value={rows[0]?.date ?? new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  const date = e.target.value;
                  setRows((prev) => prev.map((r) => ({ ...r, date })));
                }}
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🧾 Descripción del asiento
              </label>
              <input
                type="text"
                className="w-full rounded border px-3 py-2"
                placeholder="Ej: Aporte de capital inicial"
                value={rows[0]?.description || ""}
                onChange={(e) => {
                  const description = e.target.value;
                  setRows((prev) => prev.map((r) => ({ ...r, description })));
                }}
                disabled={isSaving}
              />
            </div>
          </div>
          <div className="max-h-[60vh] overflow-auto rounded border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
                <tr className="border-b">
                  <th className="border p-2 w-[180px]">Código</th>
                  <th className="border p-2 min-w-[320px]">Cuenta</th>
                  <th className="border p-2 text-right w-[120px]">Débito</th>
                  <th className="border p-2 text-right w-[120px]">Crédito</th>
                  <th className="border p-2 w-[60px]" aria-label="acciones" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const selected = selectedIdx === idx;
                  const codeValue = r.account_code || "";
                  return (
                    <tr 
                      key={r.id} 
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
                            <option 
                              key={a.code} 
                              value={a.code}
                              disabled={a.code.length < 7}
                            >
                              {a.code} - {a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border p-2">
                        {isSaving ? (
                          <input
                          type="text"
                          className="w-full rounded bordeer px-2 py-2 text-sm bg-gray-50"
                          value={r.account_name}
                          disabled
                        />
                        ) : (
                        <AccountPicker
                          accounts={accounts.filter((a) => a.code.length >= 7)}
                          value={codeValue ? { code: codeValue, name: r.account_name } : null}
                          onChange={(acc) => {
                            if (!acc) return;
                            patchRow(idx, {account_code: acc.code, account_name: acc.name });
                          }}
                          placeholder="Buscar cuenta..."
                          displayMode="name"
                          inputClassName="w-full rounded border px-2 py-2"
                        />
                      )}
                      </td>
                      <td className="border p-2 text-right">
                        <input 
                          inputMode="decimal" 
                          type="number" 
                          step="0.01" 
                          className="w-full rounded border px-2 py-2 text-right" 
                          value={r.debit ?? ""} 
                          onChange={(ev) => setAmount(idx, "debit", ev.target.value)}
                          disabled={isSaving}
                        />
                      </td>
                      <td className="border p-2 text-right">
                        <input 
                          inputMode="decimal" 
                          type="number" 
                          step="0.01" 
                          className="w-full rounded border px-2 py-2 text-right" 
                          value={r.credit ?? ""} 
                          onChange={(ev) => setAmount(idx, "credit", ev.target.value)}
                          disabled={isSaving}
                        />
                      </td>
                      <td className="border p-2 text-center">
                        <button 
                          className="rounded bg-rose-600 px-2 py-1 text-white hover:bg-rose-700 disabled:opacity-50" 
                          onClick={() => removeRow(idx)}
                          disabled={rows.length <= 1 || isSaving}
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
                  <td className="border p-2" colSpan={3}>Totales</td>
                  <td className="border p-2 text-right">{totals.debit.toFixed(2)}</td>
                  <td className="border p-2 text-right">{totals.credit.toFixed(2)}</td>
                  <td className="border p-2 text-center">
                    {isBalanced ? (
                      <span className="text-emerald-700">✓ Balanceado</span>
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
              disabled={isSaving}
              className="rounded bg-slate-200 px-4 py-2 text-slate-800 hover:bg-slate-300 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave} 
              disabled={!isBalanced || isSaving} 
              className={`rounded px-4 py-2 text-white ${
                isBalanced && !isSaving
                  ? "bg-blue-600 hover:bg-blue-700" 
                  : "bg-blue-300 cursor-not-allowed"
              }`}
            >
              {isSaving ? "⏳ Guardando..." : "💾 Guardar asiento"}
            </button>
          </div>
        </div>
      </Rnd>
    </div>,
    document.body
  );
}