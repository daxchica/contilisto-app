// src/components/journal/JournalTable.tsx
// ============================================================================
// JournalTable — Libro Diario
// - All columns sortable
// - Search: matching transaction groups float to the top
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
  | "journalId"
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

function getTxKey(e: JournalEntry): string {
  return (e as any).transactionId || e.invoice_number || (e as any).documentRef || "no-group";
}

function matchesSearch(e: JournalEntry, q: string): boolean {
  const fields = [
    e.journalId ?? "",
    e.date ?? "",
    e.invoice_number ?? "",
    (e as any).documentRef ?? "",
    e.account_code ?? "",
    e.account_name ?? "",
    (e as any).transactionId ?? "",
    (e as any).comment ?? "",
    (e as any).description ?? "",
    (e.debit ?? 0) > 0 ? String(e.debit) : "",
    (e.credit ?? 0) > 0 ? String(e.credit) : "",
  ];
  return fields.some((f) => f.toLowerCase().includes(q));
}

export default function JournalTable({
  entries,
  entityName,
  onSelectEntries,
  onDeleteSelected,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) {
      return <span className="ml-1 text-gray-300 text-[10px]">⇅</span>;
    }
    return (
      <span className="ml-1 text-blue-500 text-[10px]">
        {sortDirection === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  // ── Step 1: build base rows ──
  const rows = useMemo(
    () => entries.map((e, idx) => ({ e, rowId: buildRowId(e, idx) })),
    [entries]
  );

  // ── Step 2: sort only (no grouping yet) ──
  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;

    return [...rows].sort((a, b) => {
      const ea = a.e;
      const eb = b.e;
      let aVal: any;
      let bVal: any;

      switch (sortKey) {
        case "journalId":
          aVal = ea.journalId ?? "";
          bVal = eb.journalId ?? "";
          break;
        case "date":
          aVal = Date.parse(ea.date) || 0;
          bVal = Date.parse(eb.date) || 0;
          break;
        case "invoice":
          aVal = ea.invoice_number ?? (ea as any).documentRef ?? "";
          bVal = eb.invoice_number ?? (eb as any).documentRef ?? "";
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

  // ── Step 3: search → float matching groups to top, then regroup ──
  const displayRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let ordered = sortedRows;
    let hasSearch = false;

    if (q) {
      hasSearch = true;

      // Determine which transaction groups contain a match
      const matchingTxKeys = new Set<string>();
      for (const { e } of sortedRows) {
        if (matchesSearch(e, q)) matchingTxKeys.add(getTxKey(e));
      }

      // Partition: matching groups first, rest below
      const matching = sortedRows.filter((r) => matchingTxKeys.has(getTxKey(r.e)));
      const rest = sortedRows.filter((r) => !matchingTxKeys.has(getTxKey(r.e)));
      ordered = [...matching, ...rest];
    }

    // Re-apply grouping after reorder
    let lastKey = "";
    let groupIndex = -1;
    const q2 = searchQuery.trim().toLowerCase();

    const matchingTxKeys = new Set<string>();
    if (hasSearch) {
      for (const { e } of sortedRows) {
        if (matchesSearch(e, q2)) matchingTxKeys.add(getTxKey(e));
      }
    }

    return ordered.map((row) => {
      const key = getTxKey(row.e);
      const isFirst = key !== lastKey;
      if (isFirst) { groupIndex++; lastKey = key; }
      const isMatch = hasSearch && matchingTxKeys.has(key);
      const isFirstNonMatch =
        hasSearch &&
        !isMatch &&
        isFirst &&
        // find if previous group was a match
        groupIndex > 0;
      return { ...row, groupIndex, isFirst, isMatch, isFirstNonMatch: false };
    }).map((row, idx, arr) => {
      // Mark the very first non-matching row for the divider
      if (!row.isMatch && searchQuery.trim()) {
        const prevRow = arr[idx - 1];
        if (!prevRow || prevRow.isMatch) {
          return { ...row, isFirstNonMatch: true };
        }
      }
      return row;
    });
  }, [sortedRows, searchQuery]);

  // ── Selection ──
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});

  const selectedCount = useMemo(
    () => Object.keys(selectedMap).length,
    [selectedMap]
  );

  const selectedEntries = useMemo(
    () => displayRows.filter((r) => selectedMap[r.rowId]).map((r) => r.e),
    [displayRows, selectedMap]
  );

  useEffect(() => {
    onSelectEntries?.(selectedEntries);
  }, [selectedEntries, onSelectEntries]);

  useEffect(() => {
    setSelectedMap((prev) => {
      const next: Record<string, boolean> = {};
      displayRows.forEach((r) => { if (prev[r.rowId]) next[r.rowId] = true; });
      return next;
    });
  }, [displayRows]);

  const toggleRow = useCallback((rowId: string) => {
    setSelectedMap((prev) => ({ ...prev, [rowId]: !prev[rowId] }));
  }, []);

  const toggleAll = useCallback(() => {
    if (!displayRows.length) return;
    if (selectedCount === displayRows.length) { setSelectedMap({}); return; }
    const next: Record<string, boolean> = {};
    displayRows.forEach((r) => (next[r.rowId] = true));
    setSelectedMap(next);
  }, [displayRows, selectedCount]);

  const allChecked = displayRows.length > 0 && selectedCount === displayRows.length;

  // ── PDF export ──
  const exportToPDF = () => {
    const data = selectedCount > 0 ? selectedEntries : displayRows.map((r) => r.e);
    if (!data.length) { alert("No hay registros para exportar."); return; }

    const doc = new jsPDF();
    doc.text(`Registros de Diario - ${entityName || "Empresa"}`, 14, 16);

    autoTable(doc, {
      head: [["Asiento", "Fecha", "Factura", "Código", "Cuenta", "Débito", "Crédito"]],
      body: data.map((e) => [
        e.journalId ?? "-",
        e.date,
        e.invoice_number || (e as any).documentRef || (e as any).description || "-",
        e.account_code,
        e.account_name,
        fmtMoney(e.debit),
        fmtMoney(e.credit),
      ]),
      startY: 22,
    });

    doc.save("registros-diario.pdf");
  };

  const hasSearch = searchQuery.trim().length > 0;
  const matchCount = hasSearch
    ? new Set(displayRows.filter((r) => r.isMatch).map((r) => getTxKey(r.e))).size
    : 0;

  return (
    <div className="w-full">
      {/* ── Toolbar ── */}
      <div className="bg-white border-b border-gray-200 rounded-t-xl shadow-sm">
        <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por factura, cuenta, código, monto…"
                className="w-full pl-8 pr-8 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Search result count */}
            {hasSearch && (
              <span className="text-xs text-blue-700 font-medium whitespace-nowrap">
                {matchCount === 0
                  ? "Sin resultados"
                  : `${matchCount} grupo${matchCount !== 1 ? "s" : ""} encontrado${matchCount !== 1 ? "s" : ""}`}
              </span>
            )}

            <span className="text-sm text-gray-500 whitespace-nowrap">
              Seleccionados: <b>{selectedCount}</b> / {displayRows.length}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={exportToPDF}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              Exportar PDF
            </button>
            {onDeleteSelected && (
              <button
                onClick={onDeleteSelected}
                disabled={selectedCount === 0}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-30"
              >
                Eliminar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white border rounded-b-xl overflow-x-auto px-4">
        <table className="min-w-[1000px] w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide select-none">
              <th className="pl-2 pr-3 py-3 w-8">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} />
              </th>

              {/* Asiento */}
              <th
                className="px-3 py-3 w-[96px] cursor-pointer hover:text-gray-800"
                onClick={() => handleSort("journalId")}
              >
                Asiento <SortIcon col="journalId" />
              </th>

              {/* Fecha */}
              <th
                className="px-3 py-3 w-[100px] cursor-pointer hover:text-gray-800"
                onClick={() => handleSort("date")}
              >
                Fecha <SortIcon col="date" />
              </th>

              {/* Factura */}
              <th
                className="px-3 py-3 w-[160px] cursor-pointer hover:text-gray-800"
                onClick={() => handleSort("invoice")}
              >
                Factura <SortIcon col="invoice" />
              </th>

              {/* Código */}
              <th
                className="px-3 py-3 w-[100px] cursor-pointer hover:text-gray-800"
                onClick={() => handleSort("account_code")}
              >
                Código <SortIcon col="account_code" />
              </th>

              {/* Cuenta */}
              <th
                className="px-3 py-3 cursor-pointer hover:text-gray-800"
                onClick={() => handleSort("account_name")}
              >
                Cuenta <SortIcon col="account_name" />
              </th>

              {/* Débito */}
              <th
                className="px-3 py-3 text-right w-[100px] cursor-pointer hover:text-gray-800"
                onClick={() => handleSort("debit")}
              >
                Débito <SortIcon col="debit" />
              </th>

              {/* Crédito */}
              <th
                className="px-3 py-3 pr-2 text-right w-[100px] cursor-pointer hover:text-gray-800"
                onClick={() => handleSort("credit")}
              >
                Crédito <SortIcon col="credit" />
              </th>
            </tr>
          </thead>

          <tbody>
            {displayRows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">
                  {hasSearch ? "No se encontraron registros que coincidan con la búsqueda." : "Sin registros."}
                </td>
              </tr>
            )}

            {displayRows.map((row) => {
              const { e, rowId, groupIndex, isFirst, isMatch, isFirstNonMatch } = row;

              const isDebit  = (e.debit  ?? 0) > 0;
              const isCredit = (e.credit ?? 0) > 0;

              return (
                <React.Fragment key={rowId}>

                  {/* ── Divider between matched and unmatched groups ── */}
                  {isFirstNonMatch && hasSearch && (
                    <tr>
                      <td colSpan={8} className="py-2 px-3 bg-gray-100 border-y text-xs text-gray-500 font-medium">
                        — Demás registros —
                      </td>
                    </tr>
                  )}

                  {/* ── Transaction group header ── */}
                  {isFirst && (
                    <tr
                      className={`border-t-2 ${
                        hasSearch && isMatch
                          ? "bg-blue-100 border-blue-400"
                          : "bg-blue-50 border-blue-300"
                      }`}
                    >
                      <td colSpan={8} className="pl-2 pr-4 py-1.5 text-xs font-semibold text-blue-900">
                        📄 {e.invoice_number || (e as any).documentRef || "Sin documento"}
                        &nbsp;|&nbsp; 📅 {e.date}
                        &nbsp;|&nbsp; 🔁 {(e as any).transactionId || "TX"}
                        {hasSearch && isMatch && (
                          <span className="ml-2 inline-block bg-blue-600 text-white rounded px-1.5 py-0.5 text-[10px] font-bold">
                            coincidencia
                          </span>
                        )}
                      </td>
                    </tr>
                  )}

                  {/* ── Data row ── */}
                  <tr
                    className={`border-b transition-colors hover:bg-blue-50
                      ${groupIndex % 2 === 0 ? "bg-gray-50" : "bg-white"}
                      ${isDebit  ? "!bg-green-50" : ""}
                      ${isCredit ? "!bg-red-50"   : ""}
                    `}
                  >
                    <td className="pl-2 pr-3 py-2">
                      <input
                        type="checkbox"
                        checked={!!selectedMap[rowId]}
                        onChange={() => toggleRow(rowId)}
                      />
                    </td>

                    {/* Asiento — only on first line of group */}
                    <td className="px-3 py-2 w-[96px]">
                      {isFirst && e.journalId ? (
                        <span className="inline-block bg-blue-700 text-white rounded px-1.5 py-0.5 font-mono text-xs tracking-wide whitespace-nowrap">
                          {e.journalId}
                        </span>
                      ) : null}
                    </td>

                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{e.date}</td>

                    <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[160px]">
                      {e.invoice_number || (e as any).documentRef || "-"}
                    </td>

                    <td className="px-3 py-2 font-mono text-gray-600">{e.account_code}</td>

                    <td className="px-3 py-2 font-medium text-gray-900 max-w-[180px] truncate" title={e.account_name}>
                      {e.account_name}
                    </td>

                    <td className="px-3 py-2 text-right font-semibold text-green-700 tabular-nums">
                      {isDebit ? fmtMoney(e.debit) : ""}
                    </td>

                    <td className="px-3 py-2 pr-2 text-right font-semibold text-red-700 tabular-nums">
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
