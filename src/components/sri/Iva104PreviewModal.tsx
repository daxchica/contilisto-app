// ============================================================================
// CONTILISTO — IVA 104 PREVIEW MODAL (PRODUCTION READY)
// ============================================================================

import React from "react";
import type { TaxDocument } from "@/types/TaxDocument";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
};

export default function Iva104PreviewModal({
  open,
  onClose,
  summary,
}: Props) {
  if (!open || !summary) return null;

  const {
    ventas12 = 0,
    compras12 = 0,
    ivaVentas = 0,
    ivaCompras = 0,
    retenciones = 0,
    ivaPagar = 0,
    documents = [],
  } = summary;

  const formatMoney = (n: number) => `$${n.toFixed(2)}`;
  const isCredit = ivaPagar < 0;

  function handleExportPDF() {
  if (!summary) return;

  const doc = new jsPDF();

  const {
    ventas12,
    compras12,
    ivaVentas,
    ivaCompras,
    retenciones = 0,
    ivaPagar,
    documents = [],
  } = summary;

  // =========================
  // HEADER
  // =========================
  doc.setFontSize(14);
  doc.text("Formulario 104 - IVA", 14, 15);

  doc.setFontSize(10);
  doc.text(`Periodo: ${new Date().toISOString().slice(0, 7)}`, 14, 22);

  // =========================
  // SUMMARY
  // =========================
  const summaryRows = [
    ["Ventas gravadas 12%", ventas12.toFixed(2)],
    ["IVA en ventas", ivaVentas.toFixed(2)],
    ["Compras gravadas 12%", compras12.toFixed(2)],
    ["IVA crédito tributario", ivaCompras.toFixed(2)],
    ["Retenciones IVA", retenciones.toFixed(2)],
    [
      ivaPagar < 0 ? "Saldo a favor" : "IVA a pagar",
      Math.abs(ivaPagar).toFixed(2),
    ],
  ];

  autoTable(doc, {
    startY: 28,
    head: [["Concepto", "Valor"]],
    body: summaryRows,
  });

  // =========================
  // DETAIL TABLE
  // =========================
  const tableRows = documents.map((docItem) => [
    docItem.type === "sale" ? "Venta" : "Compra",
    docItem.documentNumber || "-",
    docItem.date,
    docItem.base12.toFixed(2),
    (
      docItem.type === "sale"
        ? docItem.ivaVentas
        : docItem.ivaCompras
    ).toFixed(2),
    docItem.ivaRetention.toFixed(2),
  ]);

  // SAFE ACCESS (TYPE-SAFE)
const lastY =
  (doc as jsPDF & { lastAutoTable?: { finalY: number } })
    .lastAutoTable?.finalY ?? 40;

autoTable(doc, {
  startY: lastY + 10,
  head: [["Tipo", "Factura", "Fecha", "Base 12%", "IVA", "Ret IVA"]],
  body: tableRows,
});

  // =========================
  // SAVE
  // =========================
  doc.save("Formulario_104_IVA.pdf");
}

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[520px] max-h-[85vh] overflow-y-auto p-6">

        {/* ========================= */}
        {/* HEADER */}
        {/* ========================= */}
        <h2 className="text-xl font-bold text-[#0A3558] mb-4">
          Formulario 104 - IVA
        </h2>

        {/* ========================= */}
        {/* SUMMARY */}
        {/* ========================= */}
        <div className="space-y-2 text-sm">

          <div className="flex justify-between">
            <span>Ventas gravadas 12%</span>
            <span>{formatMoney(ventas12)}</span>
          </div>

          <div className="flex justify-between">
            <span>IVA en ventas</span>
            <span>{formatMoney(ivaVentas)}</span>
          </div>

          <div className="flex justify-between">
            <span>Compras gravadas 12%</span>
            <span>{formatMoney(compras12)}</span>
          </div>

          <div className="flex justify-between">
            <span>IVA crédito tributario</span>
            <span>{formatMoney(ivaCompras)}</span>
          </div>

          <div className="flex justify-between">
            <span>Retenciones IVA</span>
            <span>{formatMoney(retenciones)}</span>
          </div>

          <hr />

          <div className="flex justify-between font-bold text-base">
            <span>{isCredit ? "Saldo a favor" : "IVA a pagar"}</span>
            <span className={isCredit ? "text-green-600" : "text-red-600"}>
              {formatMoney(Math.abs(ivaPagar))}
            </span>
          </div>

        </div>

        {/* ========================= */}
        {/* DOCUMENT DETAIL */}
        {/* ========================= */}
        {documents.length > 0 && (
          <div className="mt-6">
          <h3 className="font-semibold text-sm mb-2">
            Detalle de comprobantes
          </h3>

          <div className="max-h-[260px] overflow-y-auto border rounded">
            <table className="w-full text-xs border">
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
                {documents.map((doc) => {
                  const iva =
                    doc.type === "sale"
                      ? doc.ivaVentas
                      : doc.ivaCompras;

                return (
                  <tr key={doc.transactionId} className="border-t">
                    <td className="p-2 font-medium">{doc.type === "sale" ? "Venta" : "Compra"}</td>
                    <td className="p-2 font-mono text-xs">{doc.documentNumber || "-"}</td>
                    <td className="p-2">{doc.date}</td>
                    <td className="p-2">{formatMoney(doc.base12)}</td>
                    <td className="p-2">{formatMoney(doc.type === "sale" ? doc.ivaVentas : doc.ivaCompras)}</td>
                    <td className="p-2">{formatMoney(doc.ivaRetention)}</td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
        </div>
        )}

        {/* ========================= */}
        {/* ACTIONS */}
        {/* ========================= */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Exportar PDF
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}