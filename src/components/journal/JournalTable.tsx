// src/components/journal/JournalTable.tsx
// ============================================================================
// JournalTable — Libro Diario (IMPROVED)
// - Fixed grouping logic
// - Fixed JSX issues
// - Added transaction shading
// - Added visual grouping cues
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

  const rows = useMemo(
    () => entries.map((e, idx) => ({ e, rowId: buildRowId(e, idx) })),
    [entries]
  );

  // ✅ FIXED SORT + GROUPING
  const sortedRows = useMemo(() => {
    let sorted = [...rows];

    if (sortKey) {
      sorted.sort((a, b) => {
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
            aVal = ea.invoice_number ?? ea.documentRef ?? "";
            bVal = eb.invoice_number ?? eb.documentRef ?? "";
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
    }

    // ✅ GROUPING FIXED
    let lastKey = "";
    let groupIndex = -1;

    return sorted.map((row) => {
      const e = row.e;

      const key =
        (e as any).transactionId ||
        e.invoice_number ||
        e.documentRef ||
        "no-group";

      const isFirst = key !== lastKey;

      if (isFirst) {
        groupIndex++;
        lastKey = key;
      }

      return {
        ...row,
        groupIndex,
        isFirst,
      };
    });
  }, [rows, sortKey, sortDirection]);

  const [selectedMap, setSelectedMap] =
    useState<Record<string, boolean>>({});

  const selectedCount = useMemo(
    () => Object.keys(selectedMap).length,
    [selectedMap]
  );

  const selectedEntries = useMemo(
    () => sortedRows.filter((r) => selectedMap[r.rowId]).map((r) => r.e),
    [sortedRows, selectedMap]
  );

  useEffect(() => {
    onSelectEntries?.(selectedEntries);
  }, [selectedEntries, onSelectEntries]);

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
        e.invoice_number || e.documentRef || e.description || "-",
        e.account_code,
        e.account_name,
        fmtMoney(e.debit),
        fmtMoney(e.credit),
      ]),
      startY: 22,
    });

    doc.save("registros-diario.pdf");
  };

  return (
    <div className="w-full">
      <div className="bg-white border-b border-gray-200 rounded-t-xl shadow-sm">
        <div className="px-3 py-3 flex justify-between">
          <div className="text-sm">
            Seleccionados: <b>{selectedCount}</b> / {sortedRows.length}
          </div>

          <div className="flex gap-2">
            <button onClick={exportToPDF} className="bg-blue-600 text-white px-4 py-2 rounded-lg">
              Exportar PDF
            </button>

            {onDeleteSelected && (
              <button
                onClick={onDeleteSelected}
                disabled={selectedCount === 0}
                className="bg-red-600 text-white px-4 py-2 rounded-lg disabled:opacity-30"
              >
                Eliminar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-b-xl overflow-x-auto">
        <table className="min-w-[950px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
              <th onClick={() => handleSort("date")}>Fecha{sortIcon("date")}</th>
              <th onClick={() => handleSort("invoice")}>Factura{sortIcon("invoice")}</th>
              <th>Código</th>
              <th>Cuenta</th>
              <th className="text-right">Débito</th>
              <th className="text-right">Crédito</th>
            </tr>
          </thead>

          <tbody>
            {sortedRows.map((row, index) => {
              const { e, rowId, groupIndex, isFirst } = row;

              const isDebit = (e.debit ?? 0) > 0;
              const isCredit = (e.credit ?? 0) > 0;

              return (
                <React.Fragment key={rowId}>
                  
                  {/* ✅ TRANSACTION HEADER (only first row of group) */}
                  {isFirst && (
                    <tr className="bg-blue-50 border-t-2 border-blue-300">
                      <td colSpan={7} className="px-3 py-2 text-xs font-semibold text-blue-900">
                        📄 {e.invoice_number || e.documentRef || "Sin documento"} 
                        &nbsp;|&nbsp; 📅 {e.date} 
                        &nbsp;|&nbsp; 🔁 {(e as any).transactionId || "TX"}
                      </td>
                    </tr>
                  )}

                  {/* ✅ DATA ROW */}
                  <tr
                    className={`
                      border-b
                      transition-colors

                      ${groupIndex % 2 === 0 ? "bg-gray-50" : "bg-white"}

                      ${isDebit ? "bg-green-50" : ""}
                      ${isCredit ? "bg-red-50" : ""}

                      hover:bg-blue-100
                    `}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={!!selectedMap[rowId]}
                        onChange={() => toggleRow(rowId)}
                      />
                    </td>

                    <td>{e.date}</td>

                    <td className="font-medium">
                      {e.invoice_number || e.documentRef || "-"}
                    </td>

                    <td className="text-gray-700">{e.account_code}</td>

                    <td className="font-medium text-gray-900">
                      {e.account_name}
                    </td>

                    {/* ✅ DEBIT */}
                    <td className="text-right font-semibold text-green-700">
                      {isDebit ? fmtMoney(e.debit) : ""}
                    </td>

                    {/* ✅ CREDIT */}
                    <td className="text-right font-semibold text-red-700">
                      {isCredit ? fmtMoney(e.credit) : ""}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}