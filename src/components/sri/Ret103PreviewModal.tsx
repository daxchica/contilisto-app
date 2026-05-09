// ============================================================================
// CONTILISTO — Formulario 103 Preview Modal — Reporte de Retenciones Air
// ============================================================================

import React, { useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Ret103LineDetail } from "@/services/sri/generateRet103";

/* =============================================================================
   TYPES
============================================================================= */

type Ret103Line = {
  code: string;
  label: string;
  base: number;
  amount: number;
  percent?: number | null;
};

type Ret103DocumentDetail = {
  transactionId: string;
  documentNumber?: string;
  date: string;
  base: number;
  ivaRetention: number;
  rentaRetention: number;
};

type Ret103Summary = {
  period: string;
  ivaRetenido: number;
  rentaRetenida: number;
  totalRetenciones: number;
  ivaLines: Ret103Line[];
  rentaLines: Ret103Line[];
  documents: Ret103DocumentDetail[];
  detailLines?: Ret103LineDetail[];
  ivaDetailLines?: Ret103LineDetail[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  summary: Ret103Summary | null;
  entityName?: string;
  entityRuc?: string;
};

/* =============================================================================
   HELPERS
============================================================================= */

function fmt2(n: number): string {
  return n.toFixed(2);
}

function periodToDates(period: string): { fromDate: string; toDate: string } {
  const [y, m] = period.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    fromDate: `${period}-01`,
    toDate: `${period}-${String(lastDay).padStart(2, "0")}`,
  };
}

interface RetentionGroup {
  code: string;
  label: string;
  lines: Ret103LineDetail[];
}

function groupByRetentionCode(lines: Ret103LineDetail[]): RetentionGroup[] {
  const map = new Map<string, RetentionGroup>();
  for (const line of lines) {
    const key = `${line.retentionCode}__${line.retentionLabel}`;
    if (!map.has(key)) {
      map.set(key, { code: line.retentionCode, label: line.retentionLabel, lines: [] });
    }
    map.get(key)!.lines.push(line);
  }
  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
}

/* =============================================================================
   COMPONENT
============================================================================= */

export default function Ret103PreviewModal({
  open,
  onClose,
  summary,
  entityName = "",
  entityRuc = "",
}: Props) {
  if (!open || !summary) return null;

  const {
    period,
    ivaRetenido = 0,
    rentaRetenida = 0,
    totalRetenciones = 0,
    detailLines = [],
  } = summary;

  const { fromDate, toDate } = periodToDates(period);
  const printDate = new Date().toLocaleDateString("es-EC");

  const groups = useMemo(() => groupByRetentionCode(detailLines), [detailLines]);

  // ── Grand totals from detail lines ──
  const grandBase = detailLines.reduce((s, l) => s + l.base, 0);
  const grandIva = detailLines.reduce((s, l) => s + l.iva, 0);
  const grandTotal = detailLines.reduce((s, l) => s + l.total, 0);
  const grandRetAmount = detailLines.reduce((s, l) => s + l.retentionAmount, 0);

  // Summary by distinct retention percentages
  const summaryByPercent: Map<number, number> = useMemo(() => {
    const m = new Map<number, number>();
    for (const line of detailLines) {
      if (line.retentionAmount > 0) {
        m.set(line.retentionPercent, (m.get(line.retentionPercent) ?? 0) + line.retentionAmount);
      }
    }
    return m;
  }, [detailLines]);

  // ── PDF Export ──
  function handleExportPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(entityName || "—", pageWidth / 2, 30, { align: "center" });
    doc.text(`RUC: ${entityRuc}`, pageWidth / 2, 44, { align: "center" });

    doc.setFontSize(13);
    doc.text("Reporte de Retenciones Air", pageWidth / 2, 60, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Desde: ${fromDate}   Hasta: ${toDate}`, pageWidth / 2, 74, { align: "center" });
    doc.text(`Fecha impresión: ${printDate}`, pageWidth / 2, 86, { align: "center" });

    let startY = 100;

    for (const group of groups) {
      const groupBase = group.lines.reduce((s, l) => s + l.base, 0);
      const groupIva = group.lines.reduce((s, l) => s + l.iva, 0);
      const groupTotal = group.lines.reduce((s, l) => s + l.total, 0);
      const groupRet = group.lines.reduce((s, l) => s + l.retentionAmount, 0);

      // Group header
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`${group.code}  ${group.label}`, 30, startY);
      startY += 6;

      autoTable(doc, {
        startY,
        margin: { left: 30, right: 30 },
        headStyles: { fillColor: [220, 220, 220], textColor: 0, fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        footStyles: { fillColor: [240, 240, 240], fontStyle: "bold", fontSize: 7 },
        head: [[
          "No.", "Fecha", "Factura", "Proveedor", "RUC / C.I",
          "Base Imponible", "I.V.A.", "Total", "% Ret.Fte.", "Imp.Retenido", "Número Ret.",
        ]],
        body: group.lines.map((l) => [
          l.no, l.date, l.invoiceNumber, l.supplierName, l.supplierRUC,
          fmt2(l.base), fmt2(l.iva), fmt2(l.total),
          `${l.retentionPercent}%`, fmt2(l.retentionAmount), l.retentionCertNumber,
        ]),
        foot: [[
          `Total ${group.code}:`, "", "", "", "",
          fmt2(groupBase), fmt2(groupIva), fmt2(groupTotal), "", fmt2(groupRet), "",
        ]],
      });

      startY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 20;
      startY += 12;
    }

    // Grand total
    autoTable(doc, {
      startY,
      margin: { left: 30, right: 30 },
      headStyles: { fillColor: [30, 60, 100], textColor: 255, fontSize: 7 },
      bodyStyles: { fontStyle: "bold", fontSize: 8 },
      head: [["TOTAL GENERAL", "", "", "", "", "Base", "IVA", "Total", "", "Imp.Retenido", ""]],
      body: [["", "", "", "", "", fmt2(grandBase), fmt2(grandIva), fmt2(grandTotal), "", fmt2(grandRetAmount), ""]],
    });

    startY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 20;
    startY += 14;

    // Summary section
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN", 30, startY);
    startY += 10;

    const summaryRows: [string, string][] = [];
    const sortedPercents = Array.from(summaryByPercent.entries()).sort((a, b) => a[0] - b[0]);
    for (const [pct, amt] of sortedPercents) {
      summaryRows.push([`Retención ${pct}%`, fmt2(amt)]);
    }
    summaryRows.push(["Total Final", fmt2(grandRetAmount)]);

    autoTable(doc, {
      startY,
      margin: { left: 30, right: 30 },
      tableWidth: 220,
      headStyles: { fillColor: [220, 220, 220], textColor: 0, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      head: [["Concepto", "Valor"]],
      body: summaryRows,
    });

    doc.save(`Reporte_103_Retenciones_${period}.pdf`);
  }

  /* ── JSX ── */
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[1100px] max-h-[92vh] overflow-y-auto p-6">

        {/* HEADER */}
        <div className="text-center border-b pb-4 mb-5">
          <p className="font-bold text-sm">{entityName} — {entityRuc}</p>
          <p className="font-bold text-lg text-[#0A3558]">Reporte de Retenciones Air</p>
          <p className="text-sm text-gray-600">Desde: {fromDate} &nbsp; Hasta: {toDate}</p>
          <p className="text-sm text-gray-600">Fecha: {printDate}</p>
        </div>

        {detailLines.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No existen compras registradas en el periodo.</p>
        ) : (
          <>
            {/* GROUPS */}
            {groups.map((group) => {
              const groupBase = group.lines.reduce((s, l) => s + l.base, 0);
              const groupIva = group.lines.reduce((s, l) => s + l.iva, 0);
              const groupTotal = group.lines.reduce((s, l) => s + l.total, 0);
              const groupRet = group.lines.reduce((s, l) => s + l.retentionAmount, 0);

              return (
                <div key={`${group.code}-${group.label}`} className="mb-6">
                  <p className="font-semibold text-sm bg-gray-100 px-3 py-1 rounded-t border border-b-0">
                    {group.code} — {group.label}
                  </p>
                  <div className="overflow-x-auto border rounded-b">
                    <table className="w-full text-xs min-w-[900px]">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          {["No.", "Fecha", "Factura", "Proveedor", "RUC / C.I", "Base Imponible", "I.V.A.", "Total", "% Ret.Fte.", "Imp.Retenido", "Número Ret."].map((h) => (
                            <th key={h} className="px-2 py-1 text-left font-medium text-gray-700 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.lines.map((line) => (
                          <tr key={line.no} className="border-t hover:bg-gray-50">
                            <td className="px-2 py-1">{line.no}</td>
                            <td className="px-2 py-1 whitespace-nowrap">{line.date}</td>
                            <td className="px-2 py-1 font-mono">{line.invoiceNumber}</td>
                            <td className="px-2 py-1">{line.supplierName}</td>
                            <td className="px-2 py-1 font-mono">{line.supplierRUC}</td>
                            <td className="px-2 py-1 text-right">{fmt2(line.base)}</td>
                            <td className="px-2 py-1 text-right">{fmt2(line.iva)}</td>
                            <td className="px-2 py-1 text-right">{fmt2(line.total)}</td>
                            <td className="px-2 py-1 text-right">{line.retentionPercent}%</td>
                            <td className="px-2 py-1 text-right font-medium">{fmt2(line.retentionAmount)}</td>
                            <td className="px-2 py-1 font-mono">{line.retentionCertNumber}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100 border-t font-semibold text-xs">
                        <tr>
                          <td className="px-2 py-1" colSpan={5}>Total {group.code}:</td>
                          <td className="px-2 py-1 text-right">{fmt2(groupBase)}</td>
                          <td className="px-2 py-1 text-right">{fmt2(groupIva)}</td>
                          <td className="px-2 py-1 text-right">{fmt2(groupTotal)}</td>
                          <td></td>
                          <td className="px-2 py-1 text-right">{fmt2(groupRet)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })}

            {/* GRAND TOTAL */}
            <div className="bg-[#0A3558] text-white rounded px-4 py-2 text-sm font-semibold flex gap-8 mt-2">
              <span>TOTAL GENERAL</span>
              <span>Base: {fmt2(grandBase)}</span>
              <span>IVA: {fmt2(grandIva)}</span>
              <span>Total: {fmt2(grandTotal)}</span>
              <span>Imp.Retenido: {fmt2(grandRetAmount)}</span>
            </div>

            {/* SUMMARY */}
            <div className="mt-6 grid grid-cols-2 gap-6">
              <div>
                <p className="font-semibold text-sm mb-2">Resumen de Retenciones</p>
                <table className="text-xs border w-full max-w-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-1 text-left">Concepto</th>
                      <th className="px-3 py-1 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(summaryByPercent.entries())
                      .sort((a, b) => a[0] - b[0])
                      .map(([pct, amt]) => (
                        <tr key={pct} className="border-t">
                          <td className="px-3 py-1">Retención {pct}%</td>
                          <td className="px-3 py-1 text-right">{fmt2(amt)}</td>
                        </tr>
                      ))}
                    <tr className="border-t font-bold bg-gray-50">
                      <td className="px-3 py-1">Total Final</td>
                      <td className="px-3 py-1 text-right">{fmt2(grandRetAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p>Retenciones IVA: <span className="font-medium text-gray-700">{fmt2(ivaRetenido)}</span></p>
                <p>Retenciones Renta: <span className="font-medium text-gray-700">{fmt2(rentaRetenida)}</span></p>
                <p className="font-bold text-gray-800">Total: {fmt2(totalRetenciones)}</p>
              </div>
            </div>
          </>
        )}

        {/* ACTIONS */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
          >
            Exportar PDF
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100 text-sm"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
