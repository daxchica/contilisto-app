// src/components/ManualEntryModal.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Rnd } from "react-rnd";
import { v4 as uuidv4 } from "uuid";
import type { Account } from "../../types/AccountTypes";
import type { JournalEntry } from "../../types/JournalEntry";
import AccountPicker from "../AccountPicker";
import { canonicalPair, normalizeEntry } from "../../utils/accountPUCMap";

interface Props {
  entityId: string;
  userIdSafe: string;
  postableAccounts: Account[];
  leafCodeSet: Set<string>;
  onClose: () => void;
  onAddEntries: (entries: JournalEntry[]) => Promise<void>;
}

type Row = Omit<JournalEntry, "thirdParty" | "documentRef"> & {
  thirdParty?: string | null;
  documentRef?: string | null;
  requiresThirdParty?: boolean;
  _debitRaw?: string;
  _creditRaw?: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Crea una fila vacía con defaults seguros (sin undefined para Firestore) */
function createEmptyRow(entityId: string, userIdSafe: string): Row {
  return {
    id: uuidv4(),
    account_code: "",
    account_name: "",
    debit: 0,
    credit: 0,
    description: "",
    entityId,
    userIdSafe,
    date: todayISO(),
    source: "manual",
    isManual: true,
    createdAt: Date.now(),
    thirdParty: null,
    documentRef: null,
    requiresThirdParty: false,
  };
}

/**
 * ManualEntryModal — ahora con toggles CxC/CxP y campo “Días”
 */
export default function ManualEntryModal({
  entityId,
  userIdSafe,
  postableAccounts,
  leafCodeSet,
  onClose,
  onAddEntries,
}: Props) {
  
  const [rows, setRows] = useState<Row[]>([
    createEmptyRow(entityId, userIdSafe),
    createEmptyRow(entityId, userIdSafe),
  ]);
  
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // 🆕 Supplier info
  const [supplierName, setSupplierName] = useState<string>("");
  const [issuerRUC, setIssuerRUC] = useState<string>("");

  // Totales
  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + (r.debit ?? 0), 0);
    const credit = rows.reduce((s, r) => s + (r.credit ?? 0), 0);
    const debitTotal = +debit.toFixed(2);
    const creditTotal = +credit.toFixed(2);

    return {
      debit: debitTotal,
      credit: creditTotal,
      diff: +(debitTotal - creditTotal).toFixed(2)
    };
  }, [rows]);
  
  const isBalanced = 
    Math.abs(totals.diff) < 0.01 && 
    totals.debit > 0 && 
    totals.credit > 0;

  // Patch fila (normaliza código/nombre)

  const patchRow = (idx: number, patch: Partial<Row>) => {
  setRows((prev) => {
    const next = [...prev];
    const merged = { ...next[idx], ...patch };

    if (!merged.account_code) {
      next[idx] = merged;
      // ✅ auto-balance if editing non-last row
      return idx === next.length - 1 ? next : applyAutoBalance(next);
    }

    const canon = normalizeEntry({
      account_code: merged.account_code,
      account_name: merged.account_name,
    });

    next[idx] = {
      ...merged,
      account_code: canon.account_code,
      account_name: canon.account_name,
    };

    // ✅ auto-balance if editing non-last row
    return idx === next.length - 1 ? next : applyAutoBalance(next);
  });
};

  // Account selection

  const applyAccount = (
    idx: number, 
    acc: { code: string; name: string } | null
  ) => {

    if (!acc) return;

    if (!leafCodeSet.has(acc.code)) {
      alert(
        "⚠️ Solo se permiten subcuentas finales.\n" +
        "Crea primero la subcuenta en el Plan de Cuentas."
      );
      return;
    }
  
    const canon = canonicalPair(acc);
    
    patchRow(idx, {
      account_code: canon.code,
      account_name: canon.name,
    });
  };

  // ---------------------------------------------------------------------------
  // Row operations
  // ---------------------------------------------------------------------------

  const addRow = () => 
    setRows((prev) => [...prev, createEmptyRow(entityId, userIdSafe)]);
    
  
  const duplicateRow = () => {

    if (selectedIdx == null) return;
    
    const copy = { 
      ...rows[selectedIdx], 
      id: uuidv4(), 
      createdAt: Date.now(),
    };

    setRows(prev => {
      const next = [...prev];
      next.splice(selectedIdx + 1, 0, copy);
      return next;
    });

    setSelectedIdx(i => (i == null ? i : i + 1));
  };

  const removeRow = (idx: number) => {

    if (rows.length <= 1) return;

    setRows(prev => prev.filter((_, i) => i !== idx));

    if (selectedIdx === idx) {
      setSelectedIdx(prev => prev === null ? null : Math.max(0, Math.min(rows.length - 2, prev)));
    }
  };

   // -----------------------------
  // AUTO BALANCE FEATURE HELPER
  // -----------------------------

  const fmt2 = (n: number) =>
  (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function applyAutoBalance(next: Row[]): Row[] {
  if (next.length < 2) return next;

  const plugIdx = next.length - 1;

  const debitSum = next.slice(0, plugIdx).reduce((s, r) => s + (r.debit ?? 0), 0);
  const creditSum = next.slice(0, plugIdx).reduce((s, r) => s + (r.credit ?? 0), 0);

  const diff = +(debitSum - creditSum).toFixed(2);

  const plug = next[plugIdx];

  if (diff > 0) {
    // Need more CREDIT in last row
    next[plugIdx] = {
      ...plug,
      debit: 0,
      credit: diff,
      _debitRaw: "",
      _creditRaw: fmt2(diff),
    };
  } else if (diff < 0) {
    // Need more DEBIT in last row
    const need = Math.abs(diff);
    next[plugIdx] = {
      ...plug,
      debit: need,
      credit: 0,
      _debitRaw: fmt2(need),
      _creditRaw: "",
    };
  } else {
    // Balanced
    next[plugIdx] = {
      ...plug,
      debit: 0,
      credit: 0,
      _debitRaw: "",
      _creditRaw: "",
    };
  }

  return next;
}

  // -----------------------------
  // AUTO BALANCE FEATURE
  // -----------------------------

  const autoBalanceRow = (
    idx: number,
    side: "debit" | "credit",
    value: number
  ) => {

    const otherRows = rows.filter((_, i) => i !== idx);

    const debitSum = otherRows.reduce((s, r) => s + (r.debit ?? 0), 0);
    const creditSum = otherRows.reduce((s, r) => s + (r.credit ?? 0), 0);

    const remaining = debitSum - creditSum;

    if (side === "debit") {
      patchRow(idx, {
        debit: value,
        credit: Math.max(0, remaining + value),
      });
    }

    if (side === "credit") {
      patchRow(idx, {
        credit: value,
        debit: Math.max(0, value - remaining),
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = async () => {

    if (!isBalanced || isSaving) return;
    
    setIsSaving(true);
    
    const invalidRows = rows.filter(
      r => !r.account_code || !leafCodeSet.has(r.account_code)
    );

    if (invalidRows.length > 0) {
    alert(
      "El asiento contiene cuentas inválidas.\n\n" +
      "- Todas las lineas deben tener una subcuenta final."
    );
    setIsSaving(false);
    return;
  }

  const date = rows[0]?.date || todayISO();
  const description = rows[0]?.description?.trim() || "";

  if (!description) {
    alert("Debe ingresar una descripción del asiento.");
    setIsSaving(false);
    return;
  }

  const txId = uuidv4();

  const cleaned: JournalEntry[] = rows.map((r) => ({
    id: r.id || uuidv4(),
    entityId,
    uid: userIdSafe,
    transactionId: txId,
    
    account_code: r.account_code,
    account_name: r.account_name,
    
    debit: Number(r.debit) || 0,
    credit: Number(r.credit) || 0,
    
    date,
    description,
    
    document: `MANUAL - ${description}`,
    
    source: "manual",
    isManual: true,
    createdAt: r.createdAt || Date.now(),
    
    thirdParty: r.thirdParty ?? undefined,
    
    issuerRUC: issuerRUC || undefined,
    supplier_name: supplierName || undefined,
  }));

    if (cleaned.every(e => e.debit === 0 && e.credit === 0)) {
    alert("El asiento no contiene valores");
    setIsSaving(false);
    return;
  }

  try {
    await onAddEntries(cleaned);
    onClose();
  } catch (err) {
    console.error(err);
    alert("Error al guardar asiento.");
    setIsSaving(false);
  }
};


  // Close on outside click
  useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {

    const target = e.target as HTMLElement;

    if (!modalRef.current) return;

    const insideModal = modalRef.current.contains(target);

    const clickedPortalDropdown =
      target.closest("[data-portal-dropdown]");

    if (
      !insideModal &&
      !clickedPortalDropdown &&
      !isSaving
    ) {
      onClose();
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  
  return () =>
    document.removeEventListener("mousedown", handleClickOutside);
}, [onClose, isSaving]);

// ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <Rnd
        default={{
          x: Math.max(20, Math.round((window.innerWidth - 900) / 2)),
          y: Math.max(20, Math.round((window.innerHeight - 600) / 2)),
          width: 900,
          height: "auto",
        }}
        bounds="window"
        minWidth={860}
        dragHandleClassName="drag-header"
        enableResizing={false}
        className="bg-white rounded-xl shadow-xl border border-gray-300"
      >
        <div 
          ref={modalRef} 
          className="bg-white rounded-xl shadow-lg w-full p-6 mx-4">

          {/* HEADER */}

          <div className="drag-header cursor-move mb-4 border-b pb-3 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">
              ✍ Ingreso manual de asiento contable
            </h2>
            
          </div>

          {/* Supplier fields*/}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                👤 Contacto
              </label>
              <input
                type="text"
                className="w-full rounded border px-3 py-2"
                placeholder="Ej: Comercial ABC S.A."
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🧾 RUC
              </label>
              <input
                type="text"
                className="w-full rounded border px-3 py-2"
                placeholder="0999999999001"
                value={issuerRUC}
                onChange={(e) => setIssuerRUC(e.target.value.trim())}
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Fecha y descripción (comparten para todas las líneas) */}
          <div className="flex flex-wrap gap-4 mb-4 items-end">
            {/* Fecha */}
            <div className="flex-1 max-w-[220px]">
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

            {/* Description */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🧾 Descripción del asiento
              </label>
              <input
                type="text"
                className="w-full rounded border px-3 py-2"
                placeholder="Ej: Servicios profesionales, pago de honorarios..."
                value={rows[0]?.description || ""}
                onChange={(e) => {
                  const description = e.target.value;
                  setRows((prev) => prev.map((r) => ({ ...r, description })));
                }}
                disabled={isSaving}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mb-2">
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
          </div>
          
          {/* Table */}
          <div className="max-h-[60vh] overflow-auto rounded border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
                <tr className="border-b">
                  <th className="border p-2 w-[140px]">Código</th>
                  <th className="border p-2 min-w-[320px]">Cuenta</th>
                  <th className="border p-2 text-right w-[120px]">Débito</th>
                  <th className="border p-2 text-right w-[120px]">Crédito</th>
                  <th className="border p-2 w-[60px] text-center">*</th>
                  
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => {
                   const isLastRow = idx === rows.length - 1;
                  const selected = selectedIdx === idx;
                  const codeValue = r.account_code || "";
                  const accountSelected = !!r.account_code;

                  return (
                    <tr
                      key={r.id}
                      className={`border-t ${selected ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                      onClick={() => setSelectedIdx(idx)}
                    >

                      {/* Código */}
                      <td className="border p-2 w-[140px]">
                        <select
                          className="w-full rounded border px-2 py-2 font-mono"
                          value={codeValue}
                          onChange={(e) => {
                            const acc = postableAccounts.find(a => a.code === e.target.value);
                            if (acc) applyAccount(idx, acc);
                          }}
                          disabled={isSaving}
                        >
                          <option value="">— Seleccionar —</option>
                          {postableAccounts.map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.code}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Cuenta (AccountPicker) */}
                      <td className="border p-2 w-[420px]">
                        <div
                          data-account-picker-root
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <AccountPicker
                            accounts={postableAccounts}
                            value={
                              r.account_code
                                ? { code: r.account_code, name: r.account_name }
                                : null
                            }
                            onChange={(acc) => applyAccount(idx, acc)}
                            placeholder="Buscar cuenta..."
                            displayMode="name"
                            inputClassName="w-full rounded border px-2 py-2"
                          />
                        </div>
                      </td>
      
                      {/* Débito */}
                      <td className="border p-2 text-right align-middle">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full rounded border px-2 py-2 text-right"
                          value={
                            r._debitRaw ??
                            ((r.debit ?? 0) !== 0
                              ? Number(r.debit).toLocaleString("en-US", {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2,
                              })
                          : "")
                        }
                        onChange={(ev) => {
                          const raw = ev.target.value;
                          patchRow(idx, { _debitRaw: raw });
                          const cleaned = raw.replace(/,/g, "");
                          const num = parseFloat(cleaned);
                          if (!isNaN(num)) {
                            if (isLastRow) {
                              autoBalanceRow(idx, "debit", num);
                            } else {
                              patchRow(idx, { debit: num, credit: 0 });
                            }
                          };
                        }}
                        onBlur={(ev) => {
                          const raw = ev.target.value.replace(/,/g, "");
                          const num = parseFloat(raw);
                          const formatted =
                            isNaN(num) || num === 0
                              ? ""
                              : num.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                              });
                          patchRow(idx, { 
                            debit: isNaN(num) ? 0 : num, 
                            _debitRaw: formatted, 
                          });
                        }}

                        onKeyDown={(ev) => {
                          if (ev.key !== "Enter") return;

                          ev.preventDefault();

                          const nextIndex = idx + 1;

                          const next = document.querySelector<HTMLInputElement>(
                            `[data-credit="${idx}"]`
                          );

                          next?.focus();
                        }}
                        data-debit={idx}
                        disabled={isSaving || !accountSelected || (r.credit ?? 0) > 0}
                        />
                      </td>

                      {/* Credito */}
                      <td className="border p-2 text-right align-middle">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full rounded border px-2 py-2 text-right"
                          value={
                            r._creditRaw ??
                            ((r.credit ?? 0) !== 0
                              ? Number(r.credit).toLocaleString("en-US", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })
                            : "")
                          }
                          onChange={(ev) => {
                            const raw = ev.target.value;
                            patchRow(idx, { _creditRaw: raw });
                            const cleaned = raw.replace(/,/g, "");
                            const num = parseFloat(cleaned);
                            if (!isNaN(num)) {

                            if (isLastRow) {
                              autoBalanceRow(idx, "credit", num);
                            } else {
                              patchRow(idx, { credit: num, debit: 0 });
                            }
                          }
                          }}
                          onBlur={(ev) => {
                            const raw = ev.target.value.replace(/,/g, "");
                            const num = parseFloat(raw);
                            const formatted =
                              isNaN(num) || num === 0
                                ? ""
                                : num.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  });
                            patchRow(idx, { 
                              credit: isNaN(num) ? 0 : num, 
                              _creditRaw: formatted, 
                            });
                          }}
                          
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") {
                              ev.preventDefault();
                              const nextRow = document.querySelector<HTMLInputElement>(
                                `[data-debit="${idx + 1}"]`
                              );
                              if (nextRow) nextRow.focus();
                              else {
                                // If last row - add new one and focus it
                                addRow();
                                setTimeout(() => {
                                  const newInput = document.querySelector<HTMLInputElement>(
                                    `[data-debit="${idx + 1}"]`
                                  );
                                  newInput?.focus();
                                }, 100);
                              }
                            }
                          }}
                          data-credit={idx}
                          disabled={isSaving || !accountSelected || (r.debit ?? 0) > 0}
                      />
                      </td>
                      {/* Eliminar */}
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

              {/* Totals footer aligned under columns */}
              <tfoot>
                <tr className="bg-slate-50 font-medium">
                  <td className="border p-2 text-center" colSpan={2}>
                    Totales
                  </td>
                  <td className="border p-2 pr-6 text-right font-semibold align-middle">
                    {totals.debit.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="border p-2 pr-6 text-right font-semibold align-middle">
                    {totals.credit.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="border p-2 text-right font-semibold align-middle">
                    {isBalanced ? (
                      <span className="text-emerald-700 font-bold">✓ Balanceado</span>
                    ) : (
                      <span className="text-rose-700">Remaining: {Math.abs(totals.diff).toFixed(2)}</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Footer */}
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
                isBalanced && !isSaving ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"
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
