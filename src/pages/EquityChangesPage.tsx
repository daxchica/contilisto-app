// ============================================================================
// src/pages/EquityChangesPage.tsx
// CONTILISTO — Estado de Cambios en el Patrimonio
// Superintendencia de Compañías del Ecuador
// ============================================================================

import React, { useEffect, useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { fetchJournalEntries } from "@/services/journalService";
import { fetchInitialBalances } from "@/services/initialBalanceService";
import { initialBalancesToJournalEntries } from "@/services/initialBalanceAdapter";
import {
  computeEquityStatement,
  EQUITY_COLUMNS,
  type EquityStatement,
  type EquityRow,
} from "@/services/equityChangesService";
import type { JournalEntry } from "@/types/JournalEntry";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const currentYear = new Date().getFullYear();

const USD = (n: number) =>
  n === 0
    ? "-"
    : n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const clsCell = (v: number, rowType: EquityRow["rowType"]) =>
  [
    "text-right px-2 py-2 text-xs tabular-nums",
    rowType === "balance" ? "font-semibold" : "text-gray-700",
    v < 0 ? "text-red-600" : v === 0 ? "text-gray-400" : "",
  ]
    .filter(Boolean)
    .join(" ");

// ---------------------------------------------------------------------------
// PDF EXPORT
// ---------------------------------------------------------------------------

function exportPDF(
  stmt: EquityStatement,
  entityName: string,
  entityRuc: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });

  doc.setFontSize(11);
  doc.text(entityName.toUpperCase(), 40, 40);
  doc.setFontSize(9);
  doc.text(`RUC: ${entityRuc}`, 40, 54);
  doc.text(
    `ESTADO DE CAMBIOS EN EL PATRIMONIO — AÑO ${stmt.year}`,
    40,
    68
  );
  doc.text(
    "Cifras expresadas en dólares de los Estados Unidos de América (USD)",
    40,
    80
  );

  // Visible (non-zero) columns
  const activeCols = stmt.columns.filter((col) =>
    stmt.rows.some((r) => Math.abs(r.values[col.code] ?? 0) > 0.004)
  );

  const head = [
    ["Concepto", ...activeCols.map((c) => c.short), "TOTAL"],
  ];

  const body = stmt.rows.map((row) => [
    row.label,
    ...activeCols.map((c) => {
      const v = row.values[c.code] ?? 0;
      return v === 0 ? "-" : v.toLocaleString("en-US", { minimumFractionDigits: 2 });
    }),
    row.total === 0
      ? "-"
      : row.total.toLocaleString("en-US", { minimumFractionDigits: 2 }),
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 92,
    styles: { fontSize: 7.5, cellPadding: 3, halign: "right" },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, halign: "center" },
    columnStyles: {
      0: { halign: "left", cellWidth: 160, fontStyle: "bold" },
    },
    didParseCell: (data) => {
      const row = stmt.rows[data.row.index];
      if (data.section === "body" && row?.rowType === "balance") {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [239, 246, 255]; // light blue
      }
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 40, right: 40 },
  });

  doc.save(`estado-cambios-patrimonio-${stmt.year}.pdf`);
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export default function EquityChangesPage() {
  const { selectedEntity } = useSelectedEntity();
  const entityId   = selectedEntity?.id   ?? "";
  const entityName = selectedEntity?.name ?? "";
  const entityRuc  = selectedEntity?.ruc  ?? "";

  const [year, setYear]       = useState(currentYear);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // ── Load journal entries (+ initial balances) ──────────────────────────
  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [journal, initBals] = await Promise.all([
          fetchJournalEntries(entityId),
          fetchInitialBalances(entityId),
        ]);
        if (cancelled) return;
        const initEntries = initialBalancesToJournalEntries(initBals, entityId);
        setEntries([
          ...Array.isArray(initEntries) ? initEntries : [],
          ...Array.isArray(journal)     ? journal     : [],
        ]);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Error al cargar datos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [entityId]);

  // ── Compute statement ──────────────────────────────────────────────────
  const stmt = useMemo<EquityStatement | null>(() => {
    if (!entries.length) return null;
    try {
      return computeEquityStatement(entries, entityId, year);
    } catch {
      return null;
    }
  }, [entries, entityId, year]);

  // Columns that actually have non-zero values (skip empty columns)
  const activeCols = useMemo(
    () =>
      EQUITY_COLUMNS.filter(
        (col) =>
          stmt?.rows.some((r) => Math.abs(r.values[col.code] ?? 0) > 0.004) ??
          false
      ),
    [stmt]
  );

  // ── Year options ───────────────────────────────────────────────────────
  const yearOptions = Array.from(
    { length: 6 },
    (_, i) => currentYear - i
  );

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  if (!entityId) {
    return (
      <div className="pt-24 px-6 text-center text-gray-500">
        Selecciona una empresa para ver el estado de cambios en el patrimonio.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b px-6 py-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">
            Estado de Cambios en el Patrimonio
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {entityName} — Superintendencia de Compañías del Ecuador
          </p>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium">Año:</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Export PDF */}
        <button
          onClick={() => stmt && exportPDF(stmt, entityName, entityRuc)}
          disabled={!stmt}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar PDF
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="p-4 md:p-6">

        {loading && (
          <div className="text-center py-16 text-gray-500">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
            Cargando datos contables…
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        {!loading && !error && !stmt && (
          <div className="text-center py-16 text-gray-400">
            No hay datos contables registrados para {year}.
          </div>
        )}

        {!loading && stmt && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">

            {/* Report header */}
            <div className="px-6 py-4 bg-blue-700 text-white">
              <div className="font-bold text-base uppercase tracking-wide">
                {entityName}
              </div>
              <div className="text-blue-200 text-xs mt-0.5">RUC: {entityRuc}</div>
              <div className="font-semibold text-sm mt-2">
                ESTADO DE CAMBIOS EN EL PATRIMONIO
              </div>
              <div className="text-blue-100 text-xs">
                Por el año terminado al 31 de diciembre de {year} · Cifras en USD
              </div>
            </div>

            {/* Table — horizontal scroll for many columns */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-blue-50 border-b-2 border-blue-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 min-w-[200px] sticky left-0 bg-blue-50 z-10">
                      Concepto
                    </th>
                    {activeCols.map((col) => (
                      <th
                        key={col.code}
                        className="text-right px-2 py-3 font-semibold text-gray-700 min-w-[110px] leading-tight"
                        title={col.label}
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="text-right px-4 py-3 font-bold text-blue-800 min-w-[120px] bg-blue-100">
                      TOTAL
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {stmt.rows.map((row, idx) => {
                    const isBalance = row.rowType === "balance";
                    const isLast    = idx === stmt.rows.length - 1;

                    return (
                      <tr
                        key={idx}
                        className={[
                          isBalance
                            ? "bg-blue-50 font-semibold border-y border-blue-200"
                            : idx % 2 === 0
                              ? "bg-white hover:bg-gray-50"
                              : "bg-gray-50 hover:bg-gray-100",
                          isLast ? "border-t-2 border-blue-400" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {/* Concept label — sticky left */}
                        <td
                          className={[
                            "px-4 py-2 text-xs sticky left-0 z-10",
                            isBalance
                              ? "font-semibold text-blue-900 bg-blue-50"
                              : "text-gray-700 bg-inherit",
                            isBalance ? "pl-4" : "pl-8",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {row.label}
                        </td>

                        {/* Values per column */}
                        {activeCols.map((col) => {
                          const v = row.values[col.code] ?? 0;
                          return (
                            <td key={col.code} className={clsCell(v, row.rowType)}>
                              {v < 0
                                ? `(${USD(Math.abs(v))})`
                                : USD(v)}
                            </td>
                          );
                        })}

                        {/* Total */}
                        <td
                          className={[
                            "text-right px-4 py-2 text-xs tabular-nums bg-blue-50",
                            isBalance
                              ? "font-bold text-blue-900"
                              : "font-semibold text-blue-800",
                            row.total < 0 ? "text-red-600" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {row.total < 0
                            ? `(${USD(Math.abs(row.total))})`
                            : USD(row.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer note */}
            <div className="px-6 py-3 border-t bg-gray-50 text-[10px] text-gray-500">
              Las cifras expresadas en dólares de los Estados Unidos de América (USD) conforme a las
              Normas Internacionales de Información Financiera (NIIF) y los requerimientos de la
              Superintendencia de Compañías, Valores y Seguros del Ecuador.
            </div>
          </div>
        )}

        {/* ── Summary KPI cards ─────────────────────────────────────────── */}
        {!loading && stmt && (() => {
          const opening = stmt.rows[0];
          const closing = stmt.rows[stmt.rows.length - 1];
          const netChange = closing && opening
            ? closing.total - opening.total
            : 0;
          const ejercicio = stmt.rows.find((r) =>
            r.label.toLowerCase().includes("utilidad") ||
            r.label.toLowerCase().includes("resultado")
          );

          return (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label={`Patrimonio inicial ${year - 1}`}
                value={opening?.total ?? 0}
                color="blue"
              />
              <KpiCard
                label="Resultado del ejercicio"
                value={ejercicio?.total ?? 0}
                color={
                  (ejercicio?.total ?? 0) >= 0 ? "green" : "red"
                }
              />
              <KpiCard
                label="Variación neta"
                value={netChange}
                color={netChange >= 0 ? "green" : "red"}
              />
              <KpiCard
                label={`Patrimonio final ${year}`}
                value={closing?.total ?? 0}
                color="indigo"
                bold
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI CARD
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: number;
  color: "blue" | "green" | "red" | "indigo";
  bold?: boolean;
}) {
  const colors = {
    blue:   "bg-blue-50 border-blue-200 text-blue-800",
    green:  "bg-green-50 border-green-200 text-green-800",
    red:    "bg-red-50 border-red-200 text-red-700",
    indigo: "bg-indigo-600 border-indigo-700 text-white",
  };

  const isNeg = value < 0;

  return (
    <div className={`border rounded-xl px-4 py-3 ${colors[color]}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide opacity-70 mb-1">
        {label}
      </p>
      <p
        className={[
          "text-lg font-bold tabular-nums",
          bold ? "text-xl" : "",
        ].join(" ")}
      >
        {isNeg ? "-" : ""}$
        {Math.abs(value).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
    </div>
  );
}
