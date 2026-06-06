// ============================================================================
// src/pages/PersonalExpensesPage.tsx
// CONTILISTO — Reporte de Gastos Personales (SRI Ecuador)
// ============================================================================

import React, { useEffect, useState, useMemo, useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getAuth } from "firebase/auth";

import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { fetchJournalEntries } from "@/services/journalService";
import { fetchPersonalExpenses } from "@/services/personalExpenseStorageService";
import { getEffectiveAccountPlan } from "@/services/effectiveAccountsService";
import {
  buildPersonalExpenseReport,
  buildPersonalExpenseReportFromRecords,
  SRI_CATEGORIES,
  type PersonalExpenseReport,
  type PersonalExpenseGroup,
  type PersonalExpenseLine,
} from "@/services/personalExpensesService";
import type { Account } from "@/types/AccountTypes";
import type { JournalEntry } from "@/types/JournalEntry";
import type { PersonalExpenseRecord } from "@/types/PersonalExpenseRecord";
import ReclassifyExpenseModal from "@/components/modals/ReclassifyExpenseModal";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const currentYear = new Date().getFullYear();

const USD = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  blue:   { bg: "bg-blue-50",   border: "border-blue-300",  text: "text-blue-800",   badge: "bg-blue-600"   },
  green:  { bg: "bg-green-50",  border: "border-green-300", text: "text-green-800",  badge: "bg-green-600"  },
  purple: { bg: "bg-purple-50", border: "border-purple-300",text: "text-purple-800", badge: "bg-purple-600" },
  yellow: { bg: "bg-yellow-50", border: "border-yellow-300",text: "text-yellow-800", badge: "bg-yellow-500" },
  red:    { bg: "bg-red-50",    border: "border-red-300",   text: "text-red-800",    badge: "bg-red-600"    },
  cyan:   { bg: "bg-cyan-50",   border: "border-cyan-300",  text: "text-cyan-800",   badge: "bg-cyan-600"   },
  slate:  { bg: "bg-slate-50",  border: "border-slate-300", text: "text-slate-800",  badge: "bg-slate-600"  },
  pink:   { bg: "bg-pink-50",   border: "border-pink-300",  text: "text-pink-800",   badge: "bg-pink-600"   },
  gray:   { bg: "bg-gray-50",   border: "border-gray-300",  text: "text-gray-700",   badge: "bg-gray-500"   },
};

/* -------------------------------------------------------------------------- */
/* PDF EXPORT                                                                 */
/* -------------------------------------------------------------------------- */

function exportPDF(report: PersonalExpenseReport, entityName: string, entityRuc: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });

  // Header
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(entityName.toUpperCase(), 40, 45);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`RUC: ${entityRuc}`, 40, 58);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("GASTOS PERSONALES — NO DEDUCIBLES PARA LA EMPRESA", 40, 75);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Período: Año ${report.year}  ·  Categorías Formulario GP — SRI Ecuador`, 40, 88);

  let y = 105;

  for (const group of report.groups) {
    // Category title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 64, 175);
    doc.text(`${group.icon}  ${group.label.toUpperCase()}`, 40, y);
    doc.setTextColor(0, 0, 0);
    y += 4;

    autoTable(doc, {
      head: [["#", "Fecha", "No. Factura", "Proveedor / Emisor", "RUC", "Base", "IVA", "Total"]],
      body: group.lines.map((l, i) => [
        String(i + 1),
        l.date,
        l.invoiceNumber,
        l.supplierName,
        l.supplierRUC,
        USD(l.amount),
        l.iva > 0 ? USD(l.iva) : "-",
        USD(l.total),
      ]),
      foot: [[
        "", "", "", "SUBTOTAL", "",
        USD(group.subtotal),
        group.subtotalIva > 0 ? USD(group.subtotalIva) : "-",
        USD(group.subtotalTotal),
      ]],
      startY: y,
      styles: { fontSize: 7.5, cellPadding: 3 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      footStyles: { fillColor: [239, 246, 255], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 20, halign: "center" },
        1: { cellWidth: 60 },
        2: { cellWidth: 80 },
        3: { cellWidth: 150 },
        4: { cellWidth: 80 },
        5: { cellWidth: 55, halign: "right" },
        6: { cellWidth: 45, halign: "right" },
        7: { cellWidth: 55, halign: "right" },
      },
      margin: { left: 40, right: 40 },
    });

    y = (doc as any).lastAutoTable.finalY + 14;

    if (y > 700) {
      doc.addPage();
      y = 40;
    }
  }

  // Grand total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `TOTAL GASTOS PERSONALES:  $${USD(report.grandTotal)}   (incl. IVA: $${USD(report.grandTotalWithIva)})`,
    40,
    y + 10
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Nota: Estos gastos son NO DEDUCIBLES para la empresa (persona jurídica) conforme LORTI. " +
    "Para uso en declaración personal del contribuyente (Formulario GP).",
    40,
    y + 24
  );
  doc.setTextColor(0, 0, 0);

  doc.save(`gastos-personales-${report.year}.pdf`);
}

/* -------------------------------------------------------------------------- */
/* CATEGORY GROUP CARD                                                        */
/* -------------------------------------------------------------------------- */

// Highlight matching text in a string
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function GroupCard({ group, expanded, onToggle, onReclassify, reclassifiableIds, searchQuery }: {
  group: PersonalExpenseGroup;
  expanded: boolean;
  onToggle: () => void;
  onReclassify?: (transactionId: string) => void;
  reclassifiableIds?: Set<string>;
  searchQuery?: string;
}) {
  const c = COLOR_MAP[group.color] ?? COLOR_MAP.gray;
  const q = (searchQuery ?? "").toLowerCase().trim();

  // Filter lines by search query
  const visibleLines = q
    ? group.lines.filter((l) =>
        l.date.toLowerCase().includes(q) ||
        l.invoiceNumber.toLowerCase().includes(q) ||
        l.supplierName.toLowerCase().includes(q) ||
        l.supplierRUC.toLowerCase().includes(q) ||
        l.description?.toLowerCase().includes(q) ||
        l.total.toFixed(2).includes(q)
      )
    : group.lines;

  const n2 = (v: number) => Number(Number(v).toFixed(2));
  const filteredSubtotal      = n2(visibleLines.reduce((s, l) => s + l.amount, 0));
  const filteredSubtotalIva   = n2(visibleLines.reduce((s, l) => s + l.iva,    0));
  const filteredSubtotalTotal = n2(visibleLines.reduce((s, l) => s + l.total,  0));

  return (
    <div className={`rounded-xl border ${c.border} overflow-hidden shadow-sm`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-5 py-3 ${c.bg} hover:brightness-95 transition`}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{group.icon}</span>
          <div className="text-left">
            <p className={`font-semibold text-sm ${c.text}`}>{group.label}</p>
            <p className="text-xs text-gray-500">
              {q
                ? `${visibleLines.length} de ${group.lines.length} comprobante${group.lines.length !== 1 ? "s" : ""}`
                : `${group.lines.length} comprobante${group.lines.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className={`font-bold text-base tabular-nums ${c.text}`}>${USD(filteredSubtotal)}</p>
            {filteredSubtotalIva > 0 && (
              <p className="text-xs text-gray-500">+ IVA ${USD(filteredSubtotalIva)}</p>
            )}
          </div>
          <span className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
        </div>
      </button>

      {/* Detail table */}
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-t">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600 uppercase tracking-wide text-[10px]">
                <th className="text-left px-4 py-2">Fecha</th>
                <th className="text-left px-4 py-2">No. Factura</th>
                <th className="text-left px-4 py-2">Proveedor / Emisor</th>
                <th className="text-left px-3 py-2">RUC</th>
                <th className="text-right px-4 py-2">Base</th>
                <th className="text-right px-4 py-2">IVA</th>
                <th className="text-right px-4 py-2">Total</th>
                {onReclassify && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {visibleLines.length === 0 ? (
                <tr>
                  <td colSpan={onReclassify ? 8 : 7} className="px-4 py-4 text-center text-gray-400 text-xs">
                    Sin resultados para &ldquo;{searchQuery}&rdquo;
                  </td>
                </tr>
              ) : (
                visibleLines.map((line, i) => (
                  <tr
                    key={line.transactionId}
                    className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-4 py-2 tabular-nums text-gray-600">{line.date}</td>
                    <td className="px-4 py-2 font-mono text-gray-700">
                      <Highlight text={line.invoiceNumber} query={searchQuery ?? ""} />
                    </td>
                    <td className="px-4 py-2 text-gray-800 max-w-[200px] truncate" title={line.supplierName}>
                      <Highlight text={line.supplierName} query={searchQuery ?? ""} />
                    </td>
                    <td className="px-3 py-2 text-gray-500 font-mono">
                      <Highlight text={line.supplierRUC} query={searchQuery ?? ""} />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-800">${USD(line.amount)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-500">
                      {line.iva > 0 ? `$${USD(line.iva)}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-gray-900">${USD(line.total)}</td>
                    {onReclassify && (
                      <td className="px-3 py-2 text-center">
                        {reclassifiableIds?.has(line.transactionId) ? (
                          <button
                            title="Reclasificar como gasto empresarial"
                            onClick={() => onReclassify(line.transactionId)}
                            className="text-[10px] font-medium px-2 py-1 rounded border border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 whitespace-nowrap transition"
                          >
                            🔄 Reclasificar
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-300" title="Requiere migración previa">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className={`border-t ${c.bg} font-semibold`}>
                <td colSpan={4} className={`px-4 py-2 text-right text-xs uppercase ${c.text}`}>
                  Subtotal {group.label}
                </td>
                <td className={`px-4 py-2 text-right tabular-nums ${c.text}`}>${USD(filteredSubtotal)}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${c.text}`}>
                  {filteredSubtotalIva > 0 ? `$${USD(filteredSubtotalIva)}` : "—"}
                </td>
                <td className={`px-4 py-2 text-right tabular-nums ${c.text}`}>${USD(filteredSubtotalTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN PAGE                                                                  */
/* -------------------------------------------------------------------------- */

export default function PersonalExpensesPage() {
  const { selectedEntity } = useSelectedEntity();
  const entityId   = selectedEntity?.id   ?? "";
  const entityName = selectedEntity?.name ?? "";
  const entityRuc  = selectedEntity?.ruc  ?? "";

  const uid = getAuth().currentUser?.uid ?? "";

  const [year, setYear]       = useState(currentYear);
  // Legacy: old personal expense entries stored in journalEntries
  const [legacyEntries, setLegacyEntries] = useState<JournalEntry[]>([]);
  // New: dedicated personalExpenses collection
  const [peRecords, setPeRecords] = useState<PersonalExpenseRecord[]>([]);
  const [accounts, setAccounts]   = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Reclassify modal
  const [reclassifyRecord, setReclassifyRecord] = useState<PersonalExpenseRecord | null>(null);

  // Set of transactionIds backed by a personalExpenses record (reclassifiable)
  const reclassifiableIds = useMemo(
    () => new Set(peRecords.map((r) => r.transactionId)),
    [peRecords]
  );

  // Load both expense sources + chart of accounts in parallel
  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      fetchJournalEntries(entityId),
      fetchPersonalExpenses(entityId),
      getEffectiveAccountPlan(entityId),
    ])
      .then(([journal, records, plan]) => {
        if (cancelled) return;
        setLegacyEntries(Array.isArray(journal) ? journal : []);
        setPeRecords(Array.isArray(records) ? records : []);
        setAccounts(plan?.effectiveAccounts ?? []);
      })
      .catch((err) => { if (!cancelled) setError(err?.message ?? "Error al cargar datos"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entityId]);

  // Open reclassify modal for a given transactionId
  const handleReclassify = useCallback((transactionId: string) => {
    const record = peRecords.find((r) => r.transactionId === transactionId) ?? null;
    setReclassifyRecord(record);
  }, [peRecords]);

  // After successful reclassification: remove from local state and close modal
  const handleReclassifySuccess = useCallback((transactionId: string) => {
    setPeRecords((prev) => prev.filter((r) => r.transactionId !== transactionId));
    setReclassifyRecord(null);
  }, []);

  /** Merge the two report sources into one unified PersonalExpenseReport */
  const report = useMemo<PersonalExpenseReport | null>(() => {
    try {
      // Old entries tagged [Personal: X] that live in journalEntries
      const legacyReport = buildPersonalExpenseReport(legacyEntries, entityId, year);
      // New entries from dedicated personalExpenses collection
      const newReport    = buildPersonalExpenseReportFromRecords(peRecords, year);

      if (!legacyReport.lineCount && !newReport.lineCount) return null;

      // Merge line arrays per category
      const n2 = (v: number) => Number(Number(v).toFixed(2));
      const mergedGroups = SRI_CATEGORIES.map((cat) => {
        const lg = legacyReport.groups.find((g) => g.category === cat.key);
        const ng = newReport.groups.find((g) => g.category === cat.key);
        const lines: PersonalExpenseLine[] = [
          ...(lg?.lines ?? []),
          ...(ng?.lines ?? []),
        ].sort((a, b) => a.date.localeCompare(b.date));
        if (!lines.length) return null;
        return {
          category:      cat.key,
          label:         cat.label,
          icon:          cat.icon,
          color:         cat.color,
          lines,
          subtotal:      n2(lines.reduce((s, l) => s + l.amount, 0)),
          subtotalIva:   n2(lines.reduce((s, l) => s + l.iva, 0)),
          subtotalTotal: n2(lines.reduce((s, l) => s + l.total, 0)),
        };
      }).filter(Boolean) as PersonalExpenseGroup[];

      const grandTotal        = n2(mergedGroups.reduce((s, g) => s + g.subtotal, 0));
      const grandTotalIva     = n2(mergedGroups.reduce((s, g) => s + g.subtotalIva, 0));
      const grandTotalWithIva = n2(mergedGroups.reduce((s, g) => s + g.subtotalTotal, 0));

      return {
        year,
        groups: mergedGroups,
        grandTotal,
        grandTotalIva,
        grandTotalWithIva,
        lineCount: mergedGroups.reduce((s, g) => s + g.lines.length, 0),
      };
    } catch {
      return null;
    }
  }, [legacyEntries, peRecords, entityId, year]);

  // Expand all by default when report loads
  useEffect(() => {
    if (!report) return;
    const all: Record<string, boolean> = {};
    report.groups.forEach((g) => { all[g.category] = true; });
    setExpanded(all);
  }, [report?.groups.length, year]);

  // When a search query is active, auto-expand groups that have matching rows
  useEffect(() => {
    if (!report || !searchQuery.trim()) return;
    const q = searchQuery.toLowerCase().trim();
    setExpanded((prev) => {
      const next = { ...prev };
      report.groups.forEach((g) => {
        const hasMatch = g.lines.some(
          (l) =>
            l.date.toLowerCase().includes(q) ||
            l.invoiceNumber.toLowerCase().includes(q) ||
            l.supplierName.toLowerCase().includes(q) ||
            l.supplierRUC.toLowerCase().includes(q) ||
            l.description?.toLowerCase().includes(q) ||
            l.total.toFixed(2).includes(q)
        );
        if (hasMatch) next[g.category] = true;
      });
      return next;
    });
  }, [searchQuery, report]);

  const toggleAll = (open: boolean) => {
    if (!report) return;
    const all: Record<string, boolean> = {};
    report.groups.forEach((g) => { all[g.category] = open; });
    setExpanded(all);
  };

  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  if (!entityId) {
    return (
      <div className="pt-24 px-6 text-center text-gray-500">
        Selecciona una empresa para ver el reporte de gastos personales.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b px-6 py-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900">Gastos Personales</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {entityName} · Gastos <span className="font-semibold text-red-600">no deducibles</span> para la empresa · Categorías Formulario GP — SRI Ecuador
          </p>
        </div>

        {/* Year */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium">Año:</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none text-sm">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar factura, proveedor, RUC…"
            className="pl-8 pr-7 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600 text-base leading-none"
            >×</button>
          )}
        </div>

        {/* Expand / Collapse */}
        {report && report.groups.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => toggleAll(true)}
              className="text-xs text-blue-600 hover:underline">Expandir todo</button>
            <span className="text-gray-300">|</span>
            <button onClick={() => toggleAll(false)}
              className="text-xs text-blue-600 hover:underline">Colapsar todo</button>
          </div>
        )}

        {/* PDF */}
        <button
          onClick={() => report && exportPDF(report, entityName, entityRuc)}
          disabled={!report || report.groups.length === 0}
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
      <div className="p-4 md:p-6 max-w-6xl mx-auto">

        {loading && (
          <div className="text-center py-16 text-gray-500">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
            Cargando gastos personales…
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        {!loading && !error && report && report.groups.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🧾</div>
            <p className="text-gray-500 font-medium">No hay gastos personales registrados en {year}</p>
            <p className="text-gray-400 text-sm mt-2">
              Al registrar un comprobante, activa la opción "👤 Personal" y selecciona la categoría
              para que aparezca aquí.
            </p>
          </div>
        )}

        {!loading && report && report.groups.length > 0 && (
          <>
            {/* KPI ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <KpiCard label="Categorías con gastos" value={report.groups.length} isCount />
              <KpiCard label="Total comprobantes" value={report.lineCount} isCount />
              <KpiCard label="Total base gastos" value={report.grandTotal} />
              <KpiCard label="Total con IVA" value={report.grandTotalWithIva} highlight />
            </div>

            {/* SRI category summary bar */}
            <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Resumen por categoría SRI
              </h2>
              <div className="space-y-2">
                {report.groups.map((g) => {
                  const pct = report.grandTotal > 0
                    ? Math.round((g.subtotal / report.grandTotal) * 100)
                    : 0;
                  const c = COLOR_MAP[g.color] ?? COLOR_MAP.gray;
                  return (
                    <div key={g.category} className="flex items-center gap-3">
                      <span className="text-base w-6 text-center">{g.icon}</span>
                      <span className="text-xs text-gray-700 w-44 truncate">{g.label}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${c.badge}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-gray-600 w-24 text-right">
                        ${USD(g.subtotal)}
                      </span>
                      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category groups */}
            <div className="space-y-3">
              {report.groups
                .filter((group) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase().trim();
                  return group.lines.some(
                    (l) =>
                      l.date.toLowerCase().includes(q) ||
                      l.invoiceNumber.toLowerCase().includes(q) ||
                      l.supplierName.toLowerCase().includes(q) ||
                      l.supplierRUC.toLowerCase().includes(q) ||
                      l.description?.toLowerCase().includes(q) ||
                      l.total.toFixed(2).includes(q)
                  );
                })
                .map((group) => (
                <GroupCard
                  key={group.category}
                  group={group}
                  expanded={!!expanded[group.category]}
                  onToggle={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [group.category]: !prev[group.category],
                    }))
                  }
                  onReclassify={handleReclassify}
                  reclassifiableIds={reclassifiableIds}
                  searchQuery={searchQuery}
                />
              ))}
            </div>

            {/* Grand total footer */}
            <div className="mt-6 bg-blue-700 text-white rounded-xl px-6 py-4 flex flex-wrap justify-between items-center gap-4">
              <div>
                <p className="text-blue-200 text-xs uppercase tracking-wide font-medium">
                  Total Gastos Personales Deducibles — {year}
                </p>
                <p className="text-sm text-blue-100 mt-0.5">
                  {report.lineCount} comprobantes · {report.groups.length} categorías SRI
                </p>
              </div>
              <div className="text-right">
                <p className="text-blue-200 text-xs">Base deducible</p>
                <p className="text-3xl font-bold tabular-nums">${USD(report.grandTotal)}</p>
                {report.grandTotalIva > 0 && (
                  <p className="text-blue-300 text-xs mt-0.5">
                    IVA: ${USD(report.grandTotalIva)} · Total: ${USD(report.grandTotalWithIva)}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Reclassify modal ───────────────────────────────────────────── */}
      {reclassifyRecord && (
        <ReclassifyExpenseModal
          record={reclassifyRecord}
          entityId={entityId}
          uid={uid}
          accounts={accounts}
          onClose={() => setReclassifyRecord(null)}
          onSuccess={handleReclassifySuccess}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* KPI CARD                                                                   */
/* -------------------------------------------------------------------------- */

function KpiCard({
  label, value, isCount = false, highlight = false,
}: {
  label: string;
  value: number;
  isCount?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${highlight ? "bg-blue-700 border-blue-800 text-white" : "bg-white border-gray-200 text-gray-800"}`}>
      <p className={`text-[10px] font-medium uppercase tracking-wide mb-1 ${highlight ? "text-blue-200" : "text-gray-500"}`}>
        {label}
      </p>
      <p className="text-xl font-bold tabular-nums">
        {isCount ? value : `$${USD(value)}`}
      </p>
    </div>
  );
}
