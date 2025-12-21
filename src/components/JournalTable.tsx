// ============================================================================
// JournalTable.tsx — Responsive (mobile scroll) + TypeScript safe IDs
// ============================================================================
import React, { useMemo, useState, useEffect, useCallback } from "react";
import type { JournalEntry } from "../types/JournalEntry";

interface Props {
  entries: JournalEntry[];
  entityName: string;
  onSelectEntries: (entries: JournalEntry[]) => void;
  onDeleteSelected: () => Promise<void>;
  onSave: () => void;
}

function fmtMoney(n?: number) {
  if (typeof n !== "number") return "-";
  return n.toFixed(2);
}

/**
 * Devuelve un id SIEMPRE string para usar como key/selección.
 * - Si Firestore ya asignó entry.id → perfecto.
 * - Si aún no hay id, crea uno determinístico por fila (lo más estable posible).
 */
function getRowId(e: JournalEntry, idx: number): string {
  const raw = (e as any).id as string | undefined;
  if (raw && typeof raw === "string" && raw.trim()) return raw;

  const tx = (e as any).transactionId ?? "no-tx";
  const inv = e.invoice_number ?? "no-inv";
  const code = e.account_code ?? "no-code";
  const date = e.date ?? "no-date";
  const debit = typeof e.debit === "number" ? e.debit : 0;
  const credit = typeof e.credit === "number" ? e.credit : 0;

  // idx al final para evitar colisiones cuando todo lo demás coincide
  return `${tx}|${inv}|${code}|${date}|${debit}|${credit}|${idx}`;
}

export default function JournalTable({
  entries,
  entityName,
  onSelectEntries,
  onDeleteSelected,
}: Props) {
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});

  // Precalcula rowIds para cada entry una sola vez por render
  const rows = useMemo(
    () => entries.map((e, idx) => ({ e, rowId: getRowId(e, idx) })),
    [entries]
  );

  const selectedCount = useMemo(
    () => Object.values(selectedMap).filter(Boolean).length,
    [selectedMap]
  );

  const selectedEntriesArray = useMemo(
    () => rows.filter((r) => !!selectedMap[r.rowId]).map((r) => r.e),
    [rows, selectedMap]
  );

  useEffect(() => {
    onSelectEntries(selectedEntriesArray);
  }, [selectedEntriesArray, onSelectEntries]);

  // Si cambian entries (por refresh), limpia selecciones que ya no existan
  useEffect(() => {
    if (!rows.length) {
      setSelectedMap({});
      return;
    }
    setSelectedMap((prev) => {
      const next: Record<string, boolean> = {};
      for (const r of rows) {
        if (prev[r.rowId]) next[r.rowId] = true;
      }
      return next;
    });
  }, [rows]);

  const toggleItem = useCallback((rowId: string) => {
    setSelectedMap((prev) => ({ ...prev, [rowId]: !prev[rowId] }));
  }, []);

  const toggleAll = useCallback(() => {
    if (!rows.length) return;

    if (selectedCount === rows.length) {
      setSelectedMap({});
      return;
    }

    const next: Record<string, boolean> = {};
    rows.forEach((r) => (next[r.rowId] = true));
    setSelectedMap(next);
  }, [rows, selectedCount]);

  const allChecked = rows.length > 0 && selectedCount === rows.length;

  return (
    <div className="w-full">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 rounded-t-xl shadow-sm">
        <div className="px-3 sm:px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-700">
            Seleccionados:{" "}
            <span className="font-semibold">{selectedCount}</span> /{" "}
            <span className="font-semibold">{rows.length}</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={() => alert("Generar PDF Coming Soon!")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              type="button"
            >
              📄 Exportar a PDF
            </button>

            <button
              onClick={onDeleteSelected}
              disabled={selectedCount === 0}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-30"
              type="button"
            >
              🗑 Eliminar seleccionados
            </button>
          </div>
        </div>
      </div>

      {/* TABLE WRAPPER (mobile scroll) */}
      <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 border-t-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-[11px] sm:text-xs text-gray-600 uppercase border-b">
                <th className="px-2 sm:px-3 py-2 w-[40px]">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                </th>

                <th className="px-2 sm:px-3 py-2 w-[110px]">Fecha</th>
                <th className="px-2 sm:px-3 py-2 w-[140px]">Factura</th>
                <th className="px-2 sm:px-3 py-2 w-[120px]">Código</th>

                <th className="px-2 sm:px-3 py-2 min-w-[260px]">
                  Nombre de Cuenta
                </th>

                <th className="px-2 sm:px-3 py-2 w-[140px] text-right">Débito</th>
                <th className="px-2 sm:px-3 py-2 w-[140px] text-right">Crédito</th>
              </tr>
            </thead>

            <tbody>
              {rows.map(({ e: entry, rowId }) => (
                <tr key={rowId} className="border-b hover:bg-gray-50 transition">
                  <td className="px-2 sm:px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!selectedMap[rowId]}
                      onChange={() => toggleItem(rowId)}
                    />
                  </td>

                  <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                    {entry.date ?? "-"}
                  </td>

                  <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                    {entry.invoice_number ?? "-"}
                  </td>

                  <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                    {entry.account_code}
                  </td>

                  <td className="px-2 sm:px-3 py-2">
                    <div className="max-w-[360px] truncate">{entry.account_name}</div>
                  </td>

                  <td className="px-2 sm:px-3 py-2 text-right whitespace-nowrap">
                    {fmtMoney(entry.debit)}
                  </td>

                  <td className="px-2 sm:px-3 py-2 text-right whitespace-nowrap">
                    {fmtMoney(entry.credit)}
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    No hay registros todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* <div className="mt-2 text-xs text-gray-500">Empresa: {entityName}</div> */}
    </div>
  );
}