// ============================================================================
// src/components/modals/ManualEntryModal.tsx
// CONTILISTO — Manual Journal Entry
// UI identical to JournalPreviewModal.
// ============================================================================

import React, { useMemo, useState } from "react";
import { Rnd } from "react-rnd";
import { v4 as uuidv4 } from "uuid";

import type { Account } from "@/types/AccountTypes";
import type { JournalEntry } from "@/types/JournalEntry";

import AccountPicker from "@/components/AccountPicker";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  entityId: string;
  userIdSafe: string;
  postableAccounts: Account[];
  leafCodeSet: Set<string>;
  onClose: () => void;
  onAddEntries: (entries: JournalEntry[]) => Promise<void>;
}

type Row = {
  id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  _debitRaw?: string;
  _creditRaw?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().slice(0, 10);

const formatMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

const parseMoney = (raw: string) => {
  const n = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function createEmptyRow(): Row {
  return { id: uuidv4(), account_code: "", account_name: "", debit: 0, credit: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ManualEntryModal({
  entityId,
  userIdSafe,
  postableAccounts,
  leafCodeSet,
  onClose,
  onAddEntries,
}: Props) {
  const [txId] = useState(() => uuidv4());

  // Header metadata
  const [date, setDate]               = useState(todayISO());
  const [note, setNote]               = useState("");
  const [invoiceNumber, setInvoice]   = useState("");
  const [supplierName, setSupplier]   = useState("");

  // Rows
  const [rows, setRows] = useState<Row[]>([createEmptyRow(), createEmptyRow()]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [saving, setSaving]           = useState(false);

  // ── Totals ────────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    const debit  = rows.reduce((s, r) => s + (r.debit  ?? 0), 0);
    const credit = rows.reduce((s, r) => s + (r.credit ?? 0), 0);
    const mathBalanced = Math.abs(debit - credit) < 0.01;
    return { debit, credit, mathBalanced };
  }, [rows]);

  // ── Row ops ───────────────────────────────────────────────────────────────

  const patchRow = (idx: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const insertRow = (afterIdx: number) => {
    setRows((prev) => {
      const next = [...prev];
      next.splice(afterIdx + 1, 0, createEmptyRow());
      return next;
    });
    setSelectedIdx(afterIdx + 1);
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 2) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (saving || !totals.mathBalanced) return;

    if (!note.trim()) {
      alert("Debe ingresar una descripción / concepto.");
      return;
    }

    const meaningfulRows = rows.filter(
      (r) => r.account_code && (r.debit > 0 || r.credit > 0)
    );
    if (meaningfulRows.length < 2) {
      alert("El asiento debe tener al menos dos líneas válidas.");
      return;
    }

    const invalidLeaf = meaningfulRows.filter(
      (r) => !leafCodeSet.has(r.account_code.replace(/\./g, "").trim())
    );
    if (invalidLeaf.length > 0) {
      alert("Solo se permiten subcuentas finales del plan de cuentas.");
      return;
    }

    setSaving(true);
    try {
      const entries: JournalEntry[] = rows.map((r) => ({
        id: r.id,
        entityId,
        uid: userIdSafe,

        transactionId: txId,
        transactionType: "invoice" as const,
        documentNature:  "purchase" as const,

        account_code: r.account_code.replace(/\./g, "").trim(),
        account_name: r.account_name.trim(),

        debit:  Number(r.debit  ?? 0),
        credit: Number(r.credit ?? 0),

        date,
        description: note.trim(),

        invoice_number:  invoiceNumber.trim() || `MAN-${txId.slice(0, 8)}`,
        supplier_name:   supplierName.trim()  || undefined,

        source:   "manual",
        isManual: true,

        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      await onAddEntries(entries);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error al guardar asiento.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      <Rnd
        default={{
          x: Math.max(20, window.innerWidth  / 2 - 430),
          y: Math.max(20, window.innerHeight / 2 - 320),
          width: 860,
          height: "auto",
        }}
        enableResizing={false}
        dragHandleClassName="drag-header"
        bounds="window"
        className="bg-white rounded-xl shadow-2xl"
      >
        {/* ── HEADER ── */}
        <div className="drag-header bg-blue-600 text-white px-6 py-4 rounded-t-xl flex justify-between items-center cursor-move">
          <span className="text-xl font-semibold">✍ Ingreso manual</span>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* ── BODY ── */}
        <div className="p-5 space-y-4">

          {/* Metadata */}
          <div className="bg-gray-100 rounded-lg p-4 text-sm grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">N° Comprobante (opcional)</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoice(e.target.value)}
                placeholder="001-001-000000001"
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Proveedor / Tercero (opcional)</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Nombre del proveedor o tercero"
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-2 text-left w-[110px]">Código</th>
                  <th className="p-2 text-left">Cuenta</th>
                  <th className="p-2 text-right w-[130px]">Débito</th>
                  <th className="p-2 text-right w-[130px]">Crédito</th>
                  <th className="w-[40px]" />
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => (
                  <React.Fragment key={r.id}>
                    <tr
                      className={`border-t ${selectedIdx === idx ? "bg-emerald-50" : ""}`}
                      onMouseDown={() => setSelectedIdx(idx)}
                    >
                      {/* Code */}
                      <td className="p-2 font-mono text-xs text-gray-500">{r.account_code}</td>

                      {/* Account picker */}
                      <td className="p-2">
                        <AccountPicker
                          accounts={postableAccounts}
                          value={r.account_code ? { code: r.account_code, name: r.account_name } : null}
                          onChange={(acc) => {
                            if (!acc) {
                              patchRow(idx, { account_code: "", account_name: "" });
                              return;
                            }
                            patchRow(idx, { account_code: acc.code, account_name: acc.name });
                          }}
                        />
                      </td>

                      {/* Debit */}
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full border rounded px-2 py-1 text-right font-mono"
                          value={r._debitRaw !== undefined ? r._debitRaw : r.debit !== 0 ? String(r.debit) : ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            patchRow(idx, { _debitRaw: raw, debit: parseMoney(raw), credit: 0 });
                          }}
                          onBlur={(e) => {
                            const num = parseMoney(e.target.value);
                            patchRow(idx, { debit: num, _debitRaw: num ? formatMoney(num) : "" });
                          }}
                        />
                      </td>

                      {/* Credit */}
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full border rounded px-2 py-1 text-right font-mono"
                          value={r._creditRaw !== undefined ? r._creditRaw : r.credit !== 0 ? String(r.credit) : ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            patchRow(idx, { _creditRaw: raw, credit: parseMoney(raw), debit: 0 });
                          }}
                          onBlur={(e) => {
                            const num = parseMoney(e.target.value);
                            patchRow(idx, { credit: num, _creditRaw: num ? formatMoney(num) : "" });
                          }}
                        />
                      </td>

                      {/* Remove */}
                      <td className="p-2 text-center text-gray-400 hover:text-red-500 cursor-pointer">
                        <button onClick={() => removeRow(idx)}>×</button>
                      </td>
                    </tr>

                    {/* Insert line link */}
                    <tr>
                      <td colSpan={5} className="px-2 py-0.5">
                        <button
                          onClick={() => insertRow(idx)}
                          className="text-xs text-blue-500 hover:text-blue-700"
                        >
                          + Insertar línea
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}

                {/* Totals row */}
                <tr className="border-t-2 font-semibold bg-gray-100">
                  <td colSpan={2} className="p-2 text-right">Totales</td>
                  <td className="p-2 text-right font-mono">{formatMoney(totals.debit)}</td>
                  <td className="p-2 text-right font-mono">{formatMoney(totals.credit)}</td>
                  <td className="text-center">
                    {totals.mathBalanced
                      ? <span className="text-emerald-600">✔</span>
                      : <span className="text-amber-500">⚠</span>
                    }
                  </td>
                </tr>

                {/* Balance difference hint */}
                {!totals.mathBalanced && (() => {
                  const diff = Math.abs(totals.debit - totals.credit);
                  const needsDebit = totals.credit > totals.debit;
                  return (
                    <tr className="bg-amber-50 border-t border-amber-200">
                      <td colSpan={5} className="px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-amber-700 font-medium">
                            ⚠ Diferencia:{" "}
                            <span className="font-mono font-bold">${formatMoney(diff)}</span>
                          </span>
                          <span className="text-amber-600">
                            Añade{" "}
                            <span className="font-mono font-bold">${formatMoney(diff)}</span>{" "}
                            al{" "}
                            <span className="font-bold">{needsDebit ? "Débito" : "Crédito"}</span>{" "}
                            para balancear
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* Footer row: note + buttons */}
          <div className="flex justify-between items-center">
            <input
              className="flex-1 border rounded px-3 py-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Descripción / concepto del asiento *"
            />

            <div className="flex gap-3 ml-4">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
              >
                Cancelar
              </button>

              <button
                onClick={handleSave}
                disabled={saving || !totals.mathBalanced}
                className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-50 hover:bg-emerald-700 text-sm"
              >
                {saving ? "Guardando..." : "Confirmar Asiento"}
              </button>
            </div>
          </div>
        </div>
      </Rnd>
    </div>
  );
}
