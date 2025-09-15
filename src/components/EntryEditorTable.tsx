// src/components/EntryEditorTable.tsx
import React, { useMemo } from "react";
import type { JournalEntry } from "../types/JournalEntry";
import type { Account } from "../types/AccountTypes";
import AccountPicker from "./AccountPicker";

type Props = {
  rows: JournalEntry[];
  accounts: Account[];
  editable?: boolean;                 // <- true en ambos modales
  showToolbar?: boolean;              // <- lo muestra JournalPreview y Manual
  selectedIdx?: number | null;
  onChange: (next: JournalEntry[]) => void;
  onAddLine?: (atIndex?: number) => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
  onSelectRow?: (idx: number | null) => void;
};

function format2(n?: number) {
  return typeof n === "number" ? n.toFixed(2) : "";
}

export default function EntryEditorTable({
  rows,
  accounts,
  editable = true,
  showToolbar = true,
  selectedIdx = null,
  onChange,
  onAddLine,
  onDuplicate,
  onRemove,
  onSelectRow,
}: Props) {
  const setRowPatch = (idx: number, patch: Partial<JournalEntry>) => {
    const next = [...rows];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const setAmount = (idx: number, field: "debit" | "credit", raw: string) => {
    const v = raw.trim() === "" ? undefined : Number.parseFloat(raw);
    const patch: Partial<JournalEntry> =
      field === "debit" ? { debit: Number.isFinite(v!) ? v : undefined, credit: undefined }
                        : { credit: Number.isFinite(v!) ? v : undefined, debit: undefined };
    setRowPatch(idx, patch);
  };

  const totals = useMemo(() => {
    const d = rows.reduce((s, r) => s + (r.debit ?? 0), 0);
    const c = rows.reduce((s, r) => s + (r.credit ?? 0), 0);
    const diff = +(d - c).toFixed(2);
    return { debit: +d.toFixed(2), credit: +c.toFixed(2), diff };
  }, [rows]);

  return (
    <>
      {/* Toolbar */}
      {showToolbar && editable && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded border bg-slate-50 p-2">
          <button
            onClick={() => onAddLine?.(selectedIdx ?? undefined)}
            className="rounded bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700"
          >
            ➕ Agregar línea
          </button>
          <button
            onClick={onDuplicate}
            disabled={selectedIdx == null}
            className="rounded bg-indigo-600 px-3 py-1 text-white enabled:hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⧉ Duplicar
          </button>
          <button
            onClick={onRemove}
            disabled={selectedIdx == null}
            className="rounded bg-red-600 px-3 py-1 text-white enabled:hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✖ Eliminar
          </button>
          {selectedIdx != null && (
            <span className="ml-auto text-sm text-slate-600">Fila: {selectedIdx + 1}</span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="max-h-[60vh] overflow-auto rounded border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-gray-100">
            <tr className="border-b text-xs uppercase text-gray-700">
              <th className="border p-2">Fecha</th>
              <th className="border p-2">Factura</th>
              <th className="border p-2">Código Cuenta</th>
              <th className="border p-2">Descripción</th>
              <th className="border p-2">Cuenta</th>
              <th className="border p-2 text-right">Debe</th>
              <th className="border p-2 text-right">Haber</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const isSel = editable && selectedIdx === idx;
              return (
                <tr
                  key={idx}
                  className={`border-t hover:bg-gray-50 ${isSel ? "bg-emerald-50" : ""}`}
                  onClick={() => onSelectRow?.(idx)}
                >
                  <td className="border p-2">{r.date}</td>
                  <td className="border p-2">{r.invoice_number ?? ""}</td>
                  <td className="border p-2 font-mono">{r.account_code ?? ""}</td>

                  {/* Descripción (editable) */}
                  <td className="border p-2">
                    {editable ? (
                      <input
                        className="w-full rounded border px-1"
                        value={r.description ?? ""}
                        onChange={(e) => setRowPatch(idx, { description: e.target.value })}
                        aria-label="target value"
                      />
                    ) : (
                      r.description ?? ""
                    )}
                  </td>

                  {/* Cuenta con buscador */}
                  <td className="border p-2">
                    {editable ? (
                      <AccountPicker
                        value={
                          r.account_code ? { code: r.account_code, name: r.account_name } : null
                        }
                        onChange={(acc) =>
                          setRowPatch(idx, { account_code: acc.code, account_name: acc.name })
                        }
                        accounts={accounts}
                      />
                    ) : (
                      r.account_name
                    )}
                  </td>

                  {/* Debe */}
                  <td className="border p-2 text-right">
                    {editable ? (
                      <input
                        type="number"
                        step="0.01"
                        className="w-24 rounded border px-1 text-right"
                        value={r.debit ?? ""}
                        onChange={(e) => setAmount(idx, "debit", e.target.value)}
                        aria-label="target value"
                      />
                    ) : (
                      format2(r.debit)
                    )}
                  </td>

                  {/* Haber */}
                  <td className="border p-2 text-right">
                    {editable ? (
                      <input
                        type="number"
                        step="0.01"
                        className="w-24 rounded border px-1 text-right"
                        value={r.credit ?? ""}
                        onChange={(e) => setAmount(idx, "credit", e.target.value)}
                        aria-label="set amount"
                      />
                    ) : (
                      format2(r.credit)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-medium">
              <td className="border p-2" colSpan={4}>
                Totales
              </td>
              <td className="border p-2 text-right">
                {Math.abs(totals.diff) < 0.01 ? (
                  <span className="text-emerald-700">Asiento balanceado</span>
                ) : (
                  <span className="text-red-700">Diferencia: {totals.diff.toFixed(2)}</span>
                )}
              </td>
              <td className="border p-2 text-right">{totals.debit.toFixed(2)}</td>
              <td className="border p-2 text-right">{totals.credit.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}