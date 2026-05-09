// ============================================================================
// CONTILISTO — IVA 104 PREVIEW MODAL — with Reporte IVA detail tab
// ============================================================================

import React, { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { TaxDocument } from "@/types/TaxDocument";
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
  documents?: TaxDocument[];
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

type TabId = "summary" | "reporte";

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
          ? "Sin retención IVA (0%)"
          : pct === 30
          ? "Retención IVA 30%"
          : pct === 70
          ? "Retención IVA 70%"
          : pct === 100
          ? "Retención IVA 100%"
          : `Retención IVA ${pct}%`;
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
  if (!open || !summary) return null;

  const [activeTab, setActiveTab] = useState<TabId>("summary");

  const {
    ventas12 = 0,
    compras12 = 0,
    ivaVentas = 0,
    ivaCompras = 0,
    retenciones = 0,
    ivaPagar = 0,
    documents = [],
  } = summary;

  const isCredit = ivaPagar < 0;
  const { fromDate, toDate } = useMemo(() => periodToDates(period || "2000-01"), [period]);
  const printDate = new Date().toLocaleDateString("es-EC");

  const groups = useMemo(() => groupByIvaPercent(ivaDetailLines), [ivaDetailLines]);

  const grandBase = ivaDetailLines.reduce((s, l) => s + l.base, 0);
  const grandIva = ivaDetailLines.reduce((s, l) => s + l.iva, 0);
  const grandTotal = ivaDetailLines.reduce((s, l) => s + l.total, 0);
  const grandRetAmount = ivaDetailLines.reduce((s, l) => s + l.retentionAmount, 0);

  const summaryByPercent: Map<number, number> = useMemo(() => {
    const m = new Map<number, number>();
    for (const line of ivaDetailLines) {
      if (line.retentionAmount > 0) {
        m.set(line.retentionPercent, (m.get(line.retentionPercent) ?? 0) + line.retentionAmount);
      }
    }
    return m;
  }, [ivaDetailLines]);

  // ── PDF Export (Summary) ──
  function handleExportSummaryPDF() {
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text("Formulario 104 - IVA", 14, 15);

    doc.setFontSize(10);
    doc.text(`Periodo: ${period || "—"}`, 14, 22);

    const summaryRows = [
      ["Ventas gravadas 12%", fmt2(ventas12)],
      ["IVA en ventas", fmt2(ivaVentas)],
      ["Compras gravadas 12%", fmt2(compras12)],
      ["IVA crédito tributario", fmt2(ivaCompras)],
      ["Retenciones IVA", fmt2(retenciones)],
      [
        ivaPagar < 0 ? "Saldo a favor" : "IVA a pagar",
        fmt2(Math.abs(ivaPagar)),
      ],
    ];

    autoTable(doc, {
      startY: 28,
      head: [["Concepto", "Valor"]],
      body: summaryRows,
    });

    const tableRows = documents.map((docItem) => [
      docItem.type === "sale" ? "Venta" : "Compra",
      docItem.documentNumber || "-",
      docItem.date,
      fmt2(docItem.base12),
      fmt2(docItem.type === "sale" ? docItem.ivaVentas : docItem.ivaCompras),
      fmt2(docItem.ivaRetention),
    ]);

    const lastY =
      (doc as jsPDF & { lastAutoTable?: { finalY: number } })
        .lastAutoTable?.finalY ?? 40;

    autoTable(doc, {
      startY: lastY + 10,
      head: [["Tipo", "Factura", "Fecha", "Base 12%", "IVA", "Ret IVA"]],
      body: tableRows,
    });

    doc.save(`Formulario_104_IVA_${period}.pdf`);
  }

  // ── PDF Export (Reporte IVA detail) ──
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
      doc.text(`${group.percent}%  ${group.label}`, 30, startY);
      startY += 6;

      autoTable(doc, {
        startY,
        margin: { left: 30, right: 30 },
        headStyles: { fillColor: [220, 220, 220], textColor: 0, fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        footStyles: { fillColor: [240, 240, 240], fontStyle: "bold", fontSize: 7 },
        head: [[
          "No.", "Fecha", "Factura", "Proveedor", "RUC / C.I",
          "Base Imponible", "I.V.A.", "Total", "% Ret.IVA", "Imp.Retenido", "Número Ret.",
        ]],
        body: group.lines.map((l) => [
          l.no, l.date, l.invoiceNumber, l.supplierName, l.supplierRUC,
          fmt2(l.base), fmt2(l.iva), fmt2(l.total),
          `${l.retentionPercent}%`, fmt2(l.retentionAmount), l.retentionCertNumber,
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
      head: [["TOTAL GENERAL", "", "", "", "", "Base", "IVA", "Total", "", "Imp.Retenido", ""]],
      body: [["", "", "", "", "", fmt2(grandBase), fmt2(grandIva), fmt2(grandTotal), "", fmt2(grandRetAmount), ""]],
    });

    startY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 20;
    startY += 14;

    // Summary
    const summaryRows: [string, string][] = [];
    if (summaryByPercent.has(30)) summaryRows.push(["Retención 30%", fmt2(summaryByPercent.get(30)!)]);
    if (summaryByPercent.has(70)) summaryRows.push(["Retención 70%", fmt2(summaryByPercent.get(70)!)]);
    if (summaryByPercent.has(100)) summaryRows.push(["Retención 100%", fmt2(summaryByPercent.get(100)!)]);
    const sortedOthers = Array.from(summaryByPercent.entries())
      .filter(([p]) => p !== 0 && p !== 30 && p !== 70 && p !== 100)
      .sort((a, b) => a[0] - b[0]);
    for (const [pct, amt] of sortedOthers) {
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

    doc.save(`Reporte_104_IVA_${period}.pdf`);
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[1100px] max-h-[90vh] overflow-y-auto p-6">

        {/* TABS */}
        <div className="flex gap-3 mb-5 border-b pb-2">
          <button
            onClick={() => setActiveTab("summary")}
            className={`px-4 py-1.5 rounded-t text-sm font-medium transition ${
              activeTab === "summary"
                ? "bg-[#0A3558] text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Formulario 104
          </button>
          <button
            onClick={() => setActiveTab("reporte")}
            className={`px-4 py-1.5 rounded-t text-sm font-medium transition ${
              activeTab === "reporte"
                ? "bg-[#0A3558] text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Reporte IVA
          </button>
        </div>

        {/* ════════ TAB: SUMMARY ════════ */}
        {activeTab === "summary" && (
          <>
            <h2 className="text-xl font-bold text-[#0A3558] mb-4">
              Formulario 104 - IVA
            </h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Ventas gravadas 12%</span>
                <span>${fmt2(ventas12)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA en ventas</span>
                <span>${fmt2(ivaVentas)}</span>
              </div>
              <div className="flex justify-between">
                <span>Compras gravadas 12%</span>
                <span>${fmt2(compras12)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA crédito tributario</span>
                <span>${fmt2(ivaCompras)}</span>
              </div>
              <div className="flex justify-between">
                <span>Retenciones IVA</span>
                <span>${fmt2(retenciones)}</span>
              </div>
              <hr />
              <div className="flex justify-between font-bold text-base">
                <span>{isCredit ? "Saldo a favor" : "IVA a pagar"}</span>
                <span className={isCredit ? "text-green-600" : "text-red-600"}>
                  ${fmt2(Math.abs(ivaPagar))}
                </span>
              </div>
            </div>

            {documents.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-sm mb-2">Detalle de comprobantes</h3>
                <div className="max-h-[260px] overflow-y-auto border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left">Tipo</th>
                        <th className="p-2 text-left">Factura</th>
                        <th className="p-2 text-left">Fecha</th>
                        <th className="p-2 text-left">Base 12%</th>
                        <th className="p-2 text-left">IVA</th>
                        <th className="p-2 text-left">Ret IVA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => (
                        <tr key={doc.transactionId} className="border-t">
                          <td className="p-2 font-medium">{doc.type === "sale" ? "Venta" : "Compra"}</td>
                          <td className="p-2 font-mono text-xs">{doc.documentNumber || "-"}</td>
                          <td className="p-2">{doc.date}</td>
                          <td className="p-2">{`$${fmt2(doc.base12)}`}</td>
                          <td className="p-2">{`$${fmt2(doc.type === "sale" ? doc.ivaVentas : doc.ivaCompras)}`}</td>
                          <td className="p-2">{`$${fmt2(doc.ivaRetention)}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <button
                onClick={handleExportSummaryPDF}
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
          </>
        )}

        {/* ════════ TAB: REPORTE IVA ════════ */}
        {activeTab === "reporte" && (
          <>
            {/* Header */}
            <div className="text-center border-b pb-4 mb-5">
              <p className="font-bold text-sm">{entityName} — {entityRuc}</p>
              <p className="font-bold text-lg text-[#0A3558]">Reporte de Retenciones del IVA Sri</p>
              <p className="text-sm text-gray-600">Desde: {fromDate} &nbsp; Hasta: {toDate}</p>
              <p className="text-sm text-gray-600">Fecha: {printDate}</p>
            </div>

            {ivaDetailLines.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No existen compras con retención IVA en el periodo.</p>
            ) : (
              <>
                {groups.map((group) => {
                  const gBase = group.lines.reduce((s, l) => s + l.base, 0);
                  const gIva = group.lines.reduce((s, l) => s + l.iva, 0);
                  const gTotal = group.lines.reduce((s, l) => s + l.total, 0);
                  const gRet = group.lines.reduce((s, l) => s + l.retentionAmount, 0);
                  return (
                    <div key={group.percent} className="mb-6">
                      <p className="font-semibold text-sm bg-gray-100 px-3 py-1 rounded-t border border-b-0">
                        {group.percent}% — {group.label}
                      </p>
                      <div className="overflow-x-auto border rounded-b">
                        <table className="w-full text-xs min-w-[900px]">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              {["No.", "Fecha", "Factura", "Proveedor", "RUC / C.I", "Base Imponible", "I.V.A.", "Total", "% Ret.IVA", "Imp.Retenido", "Número Ret."].map((h) => (
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
                              <td className="px-2 py-1" colSpan={5}>Total {group.percent}%:</td>
                              <td className="px-2 py-1 text-right">{fmt2(gBase)}</td>
                              <td className="px-2 py-1 text-right">{fmt2(gIva)}</td>
                              <td className="px-2 py-1 text-right">{fmt2(gTotal)}</td>
                              <td></td>
                              <td className="px-2 py-1 text-right">{fmt2(gRet)}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })}

                {/* Grand total */}
                <div className="bg-[#0A3558] text-white rounded px-4 py-2 text-sm font-semibold flex gap-8 mt-2">
                  <span>TOTAL GENERAL</span>
                  <span>Base: {fmt2(grandBase)}</span>
                  <span>IVA: {fmt2(grandIva)}</span>
                  <span>Total: {fmt2(grandTotal)}</span>
                  <span>Imp.Retenido: {fmt2(grandRetAmount)}</span>
                </div>

                {/* Summary */}
                <div className="mt-6">
                  <p className="font-semibold text-sm mb-2">Resumen de Retenciones IVA</p>
                  <table className="text-xs border w-full max-w-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-1 text-left">Concepto</th>
                        <th className="px-3 py-1 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[30, 70, 100].map((pct) =>
                        summaryByPercent.has(pct) ? (
                          <tr key={pct} className="border-t">
                            <td className="px-3 py-1">Retención {pct}%</td>
                            <td className="px-3 py-1 text-right">{fmt2(summaryByPercent.get(pct)!)}</td>
                          </tr>
                        ) : null
                      )}
                      {Array.from(summaryByPercent.entries())
                        .filter(([p]) => p !== 0 && p !== 30 && p !== 70 && p !== 100)
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
              </>
            )}

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
          </>
        )}

      </div>
    </div>
  );
}
