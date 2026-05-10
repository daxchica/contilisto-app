// ============================================================================
// CONTILISTO — IVA 104 PREVIEW MODAL — Reporte de Retenciones del IVA Sri
// ============================================================================

import React, { useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Ret104LineDetail } from "@/services/sri/generateRet103";

/* =============================================================================
   TYPES
============================================================================= */

type Iva104Summary = {
  ventas12: number;
  compras12: number;
  ivaVentas: number;
  ivaCompras: number;
  retenciones?: number;
  ivaPagar: number;
  documents?: unknown[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  summary: Iva104Summary | null;
  entityName?: string;
  entityRuc?: string;
  period?: string;
  /** Detail lines from Ret103Summary.ivaDetailLines */
  ivaDetailLines?: Ret104LineDetail[];
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

interface IvaGroup {
  percent: number;
  label: string;
  lines: Ret104LineDetail[];
}

function groupByIvaPercent(lines: Ret104LineDetail[]): IvaGroup[] {
  const map = new Map<number, IvaGroup>();
  for (const line of lines) {
    const pct = line.retentionPercent;
    if (!map.has(pct)) {
      const label =
        pct === 0
          ? "0.00 % Retenciones"
          : `${pct.toFixed(2)} % Retenciones`;
      map.set(pct, { percent: pct, label, lines: [] });
    }
    map.get(pct)!.lines.push(line);
  }
  return Array.from(map.values()).sort((a, b) => a.percent - b.percent);
}

/* =============================================================================
   COMPONENT
============================================================================= */

export default function Iva104PreviewModal({
  open,
  onClose,
  summary,
  entityName = "",
  entityRuc = "",
  period = "",
  ivaDetailLines = [],
}: Props) {
  // ── All hooks MUST run before any conditional return (Rules of Hooks) ──
  const {
    ventas12 = 0,
    compras12 = 0,
    ivaVentas = 0,
    ivaCompras = 0,
    retenciones = 0,
    ivaPagar = 0,
  } = summary ?? {};

  const isCredit = ivaPagar < 0;
  const { fromDate, toDate } = useMemo(() => periodToDates(period || "2000-01"), [period]);
  const printDate = new Date().toLocaleDateString("es-EC");

  const groups = useMemo(() => groupByIvaPercent(ivaDetailLines), [ivaDetailLines]);

  const grandBase = useMemo(() => ivaDetailLines.reduce((s, l) => s + l.base, 0), [ivaDetailLines]);
  const grandIva = useMemo(() => ivaDetailLines.reduce((s, l) => s + l.iva, 0), [ivaDetailLines]);
  const grandTotal = useMemo(() => ivaDetailLines.reduce((s, l) => s + l.total, 0), [ivaDetailLines]);
  const grandRetAmount = useMemo(() => ivaDetailLines.reduce((s, l) => s + l.retentionAmount, 0), [ivaDetailLines]);

  const summaryByPercent: Map<number, number> = useMemo(() => {
    const m = new Map<number, number>();
    for (const line of ivaDetailLines) {
      if (line.retentionAmount > 0) {
        m.set(line.retentionPercent, (m.get(line.retentionPercent) ?? 0) + line.retentionAmount);
      }
    }
    return m;
  }, [ivaDetailLines]);

  // ── Guard: render nothing when closed or no summary ──
  if (!open || !summary) return null;

  // ── PDF Export (Reporte IVA) ──
  function handleExportReportePDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(entityName || "—", pageWidth / 2, 30, { align: "center" });
    doc.text(`RUC: ${entityRuc}`, pageWidth / 2, 44, { align: "center" });

    doc.setFontSize(13);
    doc.text("Reporte de Retenciones del IVA Sri", pageWidth / 2, 60, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Desde: ${fromDate}   Hasta: ${toDate}`, pageWidth / 2, 74, { align: "center" });
    doc.text(`Fecha impresión: ${printDate}`, pageWidth / 2, 86, { align: "center" });

    let startY = 100;

    for (const group of groups) {
      const gBase = group.lines.reduce((s, l) => s + l.base, 0);
      const gIva = group.lines.reduce((s, l) => s + l.iva, 0);
      const gTotal = group.lines.reduce((s, l) => s + l.total, 0);
      const gRet = group.lines.reduce((s, l) => s + l.retentionAmount, 0);

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`${group.percent.toFixed(2)}  % Retenciones`, 30, startY);
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
          l.retentionPercent.toFixed(2),
          fmt2(l.retentionAmount),
          l.retentionCertNumber !== "-" ? l.retentionCertNumber : "0",
        ]),
        foot: [[
          `Total ${group.percent}%:`, "", "", "", "",
          fmt2(gBase), fmt2(gIva), fmt2(gTotal), "", fmt2(gRet), "",
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
      head: [["Total Final", "", "", "", "", "Base Imponible", "I.V.A.", "Total", "", "Imp.Retenido", ""]],
      body: [["", "", "", "", "", fmt2(grandBase), fmt2(grandIva), fmt2(grandTotal), "", fmt2(grandRetAmount), ""]],
    });

    startY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 20;
    startY += 14;

    // Summary
    const summaryRows: [string, string][] = [
      ["Retención 30%",  fmt2(summaryByPercent.get(30)  ?? 0)],
      ["Retención 70%",  fmt2(summaryByPercent.get(70)  ?? 0)],
      ["Retención 100%", fmt2(summaryByPercent.get(100) ?? 0)],
    ];
    const sortedOthers = Array.from(summaryByPercent.entries())
      .filter(([p]) => p !== 0 && p !== 30 && p !== 70 && p !== 100)
      .sort((a, b) => a[0] - b[0]);
    for (const [pct, amt] of sortedOthers) {
      summaryRows.push([`Retención ${pct}%`, fmt2(amt)]);
    }
    summaryRows.push(["Total:", fmt2(grandRetAmount)]);

    autoTable(doc, {
      startY,
      margin: { left: 30, right: 30 },
      tableWidth: 220,
      headStyles: { fillColor: [220, 220, 220], textColor: 0, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      head: [["Concepto", "Valor"]],
      body: summaryRows,
    });

    doc.save(`Reporte_104_IVA_${period}.pdf`);
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[1120px] max-h-[90vh] overflow-y-auto p-6">

        {/* ── Header — matches template layout ── */}
        <div className="text-center border-b pb-4 mb-5">
          <p className="font-bold text-sm">{entityName} — {entityRuc}</p>
          <p className="font-bold text-lg text-[#0A3558]">Reporte de Retenciones del IVA Sri</p>
          <p className="text-sm text-gray-600">Desde: {fromDate} &nbsp;&nbsp; Hasta: {toDate}</p>
          <p className="text-sm text-gray-600">Fecha: {printDate}</p>
        </div>

        {/* ── IVA totals band (compact, for accountant context) ── */}
        <div className="flex flex-wrap gap-3 mb-5 text-xs">
          <span className="bg-gray-50 border rounded px-3 py-1.5">
            Ventas 12%: <strong className="tabular-nums">${fmt2(ventas12)}</strong>
          </span>
          <span className="bg-gray-50 border rounded px-3 py-1.5">
            IVA Ventas: <strong className="tabular-nums">${fmt2(ivaVentas)}</strong>
          </span>
          <span className="bg-gray-50 border rounded px-3 py-1.5">
            Compras 12%: <strong className="tabular-nums">${fmt2(compras12)}</strong>
          </span>
          <span className="bg-gray-50 border rounded px-3 py-1.5">
            IVA Compras: <strong className="tabular-nums">${fmt2(ivaCompras)}</strong>
          </span>
          {retenciones > 0 && (
            <span className="bg-gray-50 border rounded px-3 py-1.5">
              Ret. IVA recibidas: <strong className="tabular-nums">${fmt2(retenciones)}</strong>
            </span>
          )}
          <span className={`border rounded px-3 py-1.5 font-bold ${isCredit ? "bg-green-50 text-green-700 border-green-300" : "bg-red-50 text-red-700 border-red-300"}`}>
            {isCredit ? "Saldo a favor" : "IVA a pagar"}: <span className="tabular-nums">${fmt2(Math.abs(ivaPagar))}</span>
          </span>
        </div>

        {/* ── Main table ── */}
        {ivaDetailLines.length === 0 ? (
          <p className="text-center text-gray-500 py-12">
            No existen compras en el periodo.
          </p>
        ) : (
          <>
            {groups.map((group) => {
              const gBase  = group.lines.reduce((s, l) => s + l.base, 0);
              const gIva   = group.lines.reduce((s, l) => s + l.iva, 0);
              const gTotal = group.lines.reduce((s, l) => s + l.total, 0);
              const gRet   = group.lines.reduce((s, l) => s + l.retentionAmount, 0);
              return (
                <div key={group.percent} className="mb-6">
                  {/* Group header */}
                  <div className="bg-gray-100 border border-b-0 rounded-t px-3 py-1.5 flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-800">{group.percent.toFixed(2)}</span>
                    <span className="font-semibold text-sm text-gray-700">% Retenciones</span>
                  </div>

                  <div className="overflow-x-auto border rounded-b">
                    <table className="w-full text-xs min-w-[1000px]">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          {[
                            "No.", "Fecha", "Factura", "Proveedor",
                            "RUC / C.I", "Base Imponible", "I.V.A.", "Total",
                            "% Ret.Fte.", "Imp.Retenido", "Número Ret.",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap border-r last:border-r-0"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.lines.map((line) => (
                          <tr key={line.no} className="border-t hover:bg-blue-50">
                            <td className="px-2 py-1 text-gray-500">{line.no}</td>
                            <td className="px-2 py-1 whitespace-nowrap">{line.date}</td>
                            <td className="px-2 py-1 font-mono text-[11px]">{line.invoiceNumber}</td>
                            <td className="px-2 py-1 max-w-[180px] truncate" title={line.supplierName}>{line.supplierName}</td>
                            <td className="px-2 py-1 font-mono">{line.supplierRUC}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{fmt2(line.base)}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{fmt2(line.iva)}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{fmt2(line.total)}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{line.retentionPercent.toFixed(2)}</td>
                            <td className="px-2 py-1 text-right tabular-nums font-semibold">{fmt2(line.retentionAmount)}</td>
                            <td className="px-2 py-1 font-mono text-[11px]">
                              {line.retentionCertNumber !== "-" ? line.retentionCertNumber : "0"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100 border-t-2 font-semibold text-xs">
                        <tr>
                          <td className="px-2 py-1.5 text-right" colSpan={5}>
                            Total &nbsp;{group.percent.toFixed(2)}:
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(gBase)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(gIva)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(gTotal)}</td>
                          <td></td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(gRet)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })}

            {/* Total Final — matches template */}
            <div className="border rounded overflow-hidden mt-2">
              <table className="w-full text-xs min-w-[1000px]">
                <tbody>
                  <tr className="bg-[#0A3558] text-white font-bold">
                    <td className="px-3 py-2 text-right" colSpan={5}>Total Final</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt2(grandBase)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt2(grandIva)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt2(grandTotal)}</td>
                    <td></td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt2(grandRetAmount)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary box — matches template bottom-left */}
            <div className="mt-6">
              <table className="text-xs border w-full max-w-[240px]">
                <tbody>
                  {[30, 70, 100].map((pct) => (
                    <tr key={pct} className="border-t">
                      <td className="px-3 py-1">Retención {pct}%</td>
                      <td className="px-3 py-1 text-right tabular-nums">
                        {fmt2(summaryByPercent.get(pct) ?? 0)}
                      </td>
                    </tr>
                  ))}
                  {Array.from(summaryByPercent.entries())
                    .filter(([p]) => p !== 0 && p !== 30 && p !== 70 && p !== 100)
                    .sort((a, b) => a[0] - b[0])
                    .map(([pct, amt]) => (
                      <tr key={pct} className="border-t">
                        <td className="px-3 py-1">Retención {pct}%</td>
                        <td className="px-3 py-1 text-right tabular-nums">{fmt2(amt)}</td>
                      </tr>
                    ))}
                  <tr className="border-t-2 font-bold">
                    <td className="px-3 py-1">Total:</td>
                    <td className="px-3 py-1 text-right tabular-nums">{fmt2(grandRetAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Footer buttons ── */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={handleExportReportePDF}
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
