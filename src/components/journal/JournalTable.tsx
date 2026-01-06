// src/components/journal/JournalTable.tsx
// ============================================================================
// JournalTable — Libro Diario
// - Responsive (mobile scroll)
// - Stable row identity
// - Map-based selection (fast & safe)
// - Column sorting
// - PDF export ready
// ============================================================================

import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { JournalEntry } from "@/types/JournalEntry";

interface Props {
  entries: JournalEntry[];
  entityName?: string;
  onSelectEntries?: (entries: JournalEntry[]) => void;
  onDeleteSelected?: () => Promise<void>;
}

type SortKey =
  | "date"
  | "invoice"
  | "account_code"
  | "account_name"
  | "debit"
  | "credit"
  | null;

type SortDirection = "asc" | "desc";

function fmtMoney(n?: number) {
  if (typeof n !== "number") return "0.00";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Stable, deterministic row ID
 * - Uses Firestore id if present
 * - Fallback avoids collisions
 */
function buildRowId(e: JournalEntry, idx: number): string {
  if (e.id && typeof e.id === "string") return e.id;

  const tx = (e as any).transactionId ?? "no-tx";
  const inv = e.invoice_number ?? "no-inv";
  const code = e.account_code ?? "no-code";
  const date = e.date ?? "no-date";
  const debit = typeof e.debit === "number" ? e.debit : 0;
  const credit = typeof e.credit === "number" ? e.credit : 0;

  return `${tx}|${inv}|${code}|${date}|${debit}|${credit}|${idx}`;
}

export default function JournalTable({
  entries,
  entityName,
  onSelectEntries,
  onDeleteSelected,
}: Props) {
  // ---------------------------------------------------------------------------
  // Sorting state
  // ---------------------------------------------------------------------------
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortDirection === "asc" ? " 🔼" : " 🔽") : "";

  // ---------------------------------------------------------------------------
  // Build rows with stable IDs
  // ---------------------------------------------------------------------------
  const rows = useMemo(
    () => entries.map((e, idx) => ({ e, rowId: buildRowId(e, idx) })),
    [entries]
  );

  // ---------------------------------------------------------------------------
  // Sorting logic
  // ---------------------------------------------------------------------------
  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;

    return [...rows].sort((a, b) => {
      const ea = a.e;
      const eb = b.e;

      let aVal: any;
      let bVal: any;

      switch (sortKey) {
        case "date":
          aVal = Date.parse(ea.date) || 0;
          bVal = Date.parse(eb.date) || 0;
          break;
        case "invoice":
          aVal = ea.invoice_number ?? "";
          bVal = eb.invoice_number ?? "";
          break;
        case "account_code":
          aVal = ea.account_code ?? "";
          bVal = eb.account_code ?? "";
          break;
        case "account_name":
          aVal = ea.account_name ?? "";
          bVal = eb.account_name ?? "";
          break;
        case "debit":
          aVal = ea.debit ?? 0;
          bVal = eb.debit ?? 0;
          break;
        case "credit":
          aVal = ea.credit ?? 0;
          bVal = eb.credit ?? 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sortKey, sortDirection]);

  // ---------------------------------------------------------------------------
  // Selection (map-based)
  // ---------------------------------------------------------------------------
  const [selectedMap, setSelectedMap] =
    useState<Record<string, boolean>>({});

  const selectedCount = useMemo(
    () => Object.values(selectedMap).filter(Boolean).length,
    [selectedMap]
  );

  const selectedEntries = useMemo(
    () => sortedRows.filter((r) => selectedMap[r.rowId]).map((r) => r.e),
    [sortedRows, selectedMap]
  );

  useEffect(() => {
    onSelectEntries?.(selectedEntries);
  }, [selectedEntries, onSelectEntries]);

  // Cleanup selections when data refreshes
  useEffect(() => {
    setSelectedMap((prev) => {
      const next: Record<string, boolean> = {};
      sortedRows.forEach((r) => {
        if (prev[r.rowId]) next[r.rowId] = true;
      });
      return next;
    });
  }, [sortedRows]);

  const toggleRow = useCallback((rowId: string) => {
    setSelectedMap((prev) => ({ ...prev, [rowId]: !prev[rowId] }));
  }, []);

  const toggleAll = useCallback(() => {
    if (!sortedRows.length) return;

    if (selectedCount === sortedRows.length) {
      setSelectedMap({});
      return;
    }

    const next: Record<string, boolean> = {};
    sortedRows.forEach((r) => (next[r.rowId] = true));
    setSelectedMap(next);
  }, [sortedRows, selectedCount]);

  const allChecked =
    sortedRows.length > 0 && selectedCount === sortedRows.length;

  // ---------------------------------------------------------------------------
  // Export PDF
  // ---------------------------------------------------------------------------
  const exportToPDF = () => {
    const data =
      selectedCount > 0 ? selectedEntries : sortedRows.map((r) => r.e);

    if (!data.length) {
      alert("No hay registros para exportar.");
      return;
    }

    const doc = new jsPDF();
    doc.text(`Registros de Diario - ${entityName || "Empresa"}`, 14, 16);

    autoTable(doc, {
      head: [["Fecha", "Factura", "Código", "Cuenta", "Débito", "Crédito"]],
      body: data.map((e) => [
        e.date,
        e.invoice_number || "-",
        e.account_code,
        e.account_name,
        fmtMoney(e.debit),
        fmtMoney(e.credit),
      ]),
      startY: 22,
    });

    doc.save("registros-diario.pdf");
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="w-full">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 rounded-t-xl shadow-sm">
        <div className="px-3 sm:px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-700">
            Seleccionados:{" "}
            <span className="font-semibold">{selectedCount}</span> /{" "}
            <span className="font-semibold">{sortedRows.length}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={exportToPDF}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              type="button"
            >
              📄 Exportar PDF
            </button>

            {onDeleteSelected && (
              <button
                onClick={onDeleteSelected}
                disabled={selectedCount === 0}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-30"
                type="button"
              >
                🗑 Eliminar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 border-t-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[950px] w-full text-xs sm:text-sm">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b text-gray-600 uppercase">
                <th className="px-3 py-2 w-[40px]">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                  />
                </th>

                <th
                  className="px-3 py-2 w-[110px] cursor-pointer"
                  onClick={() => handleSort("date")}
                >
                  Fecha{sortIcon("date")}
                </th>
                <th
                  className="px-3 py-2 w-[140px] cursor-pointer"
                  onClick={() => handleSort("invoice")}
                >
                  Factura{sortIcon("invoice")}
                </th>
                <th
                  className="px-3 py-2 w-[120px] cursor-pointer"
                  onClick={() => handleSort("account_code")}
                >
                  Código{sortIcon("account_code")}
                </th>
                <th
                  className="px-3 py-2 min-w-[260px] cursor-pointer"
                  onClick={() => handleSort("account_name")}
                >
                  Cuenta{sortIcon("account_name")}
                </th>
                <th
                  className="px-3 py-2 w-[140px] text-right cursor-pointer"
                  onClick={() => handleSort("debit")}
                >
                  Débito{sortIcon("debit")}
                </th>
                <th
                  className="px-3 py-2 w-[140px] text-right cursor-pointer"
                  onClick={() => handleSort("credit")}
                >
                  Crédito{sortIcon("credit")}
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.map(({ e, rowId }) => (
                <tr
                  key={rowId}
                  className="border-b hover:bg-gray-50 transition"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!selectedMap[rowId]}
                      onChange={() => toggleRow(rowId)}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{e.date}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {e.invoice_number || "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {e.account_code}
                  </td>
                  <td className="px-3 py-2 truncate max-w-[360px]">
                    {e.account_name}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {fmtMoney(e.debit)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {fmtMoney(e.credit)}
                  </td>
                </tr>
              ))}

              {sortedRows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-8 text-gray-500"
                  >
                    No hay registros todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}