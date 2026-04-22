// ============================================================================
// CONTILISTO — Formulario 103 Preview Modal (PRODUCTION READY)
// ============================================================================

import React from "react";

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
};

type Props = {
  open: boolean;
  onClose: () => void;
  summary: Ret103Summary | null;
};

/* =============================================================================
   COMPONENT
============================================================================= */

export default function Ret103PreviewModal({
  open,
  onClose,
  summary,
}: Props) {
  if (!open || !summary) return null;

  const formatMoney = (n: number) => `$${n.toFixed(2)}`;

  const {
    ivaRetenido = 0,
    rentaRetenida = 0,
    totalRetenciones = 0,
    ivaLines = [],
    rentaLines = [],
    documents = [],
  } = summary;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[720px] max-h-[90vh] overflow-y-auto p-6">

        {/* ========================= */}
        {/* HEADER */}
        {/* ========================= */}
        <h2 className="text-xl font-bold text-[#0A3558] mb-4">
          Formulario 103 - Retenciones
        </h2>

        {/* ========================= */}
        {/* SUMMARY */}
        {/* ========================= */}
        <div className="space-y-2 text-sm">

          <div className="flex justify-between">
            <span>Retenciones IVA</span>
            <span>{formatMoney(ivaRetenido)}</span>
          </div>

          <div className="flex justify-between">
            <span>Retenciones Renta</span>
            <span>{formatMoney(rentaRetenida)}</span>
          </div>

          <hr />

          <div className="flex justify-between font-bold text-base">
            <span>Total a declarar</span>
            <span>{formatMoney(totalRetenciones)}</span>
          </div>
        </div>

        {/* ========================= */}
        {/* IVA TABLE */}
        {/* ========================= */}
        {ivaLines.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-sm mb-2">
              Retenciones IVA (SRI)
            </h3>

            <table className="w-full text-xs border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Código</th>
                  <th className="p-2 text-left">Concepto</th>
                  <th className="p-2 text-left">Base</th>
                  <th className="p-2 text-left">Valor</th>
                </tr>
              </thead>

              <tbody>
                {ivaLines.map((line) => (
                  <tr key={line.code} className="border-t">
                    <td className="p-2 font-mono">{line.code}</td>
                    <td className="p-2">{line.label}</td>
                    <td className="p-2">{formatMoney(line.base)}</td>
                    <td className="p-2">{formatMoney(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================= */}
        {/* RENTA TABLE */}
        {/* ========================= */}
        {rentaLines.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-sm mb-2">
              Retenciones Renta (SRI)
            </h3>

            <table className="w-full text-xs border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Código</th>
                  <th className="p-2 text-left">Concepto</th>
                  <th className="p-2 text-left">Base</th>
                  <th className="p-2 text-left">Valor</th>
                </tr>
              </thead>

              <tbody>
                {rentaLines.map((line) => (
                  <tr key={line.code} className="border-t">
                    <td className="p-2 font-mono">{line.code}</td>
                    <td className="p-2">{line.label}</td>
                    <td className="p-2">{formatMoney(line.base)}</td>
                    <td className="p-2">{formatMoney(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================= */}
        {/* DOCUMENT DETAIL */}
        {/* ========================= */}
        {documents.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-sm mb-2">
              Detalle de comprobantes
            </h3>

            <div className="max-h-[260px] overflow-y-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Factura</th>
                    <th className="p-2 text-left">Fecha</th>
                    <th className="p-2 text-left">Base</th>
                    <th className="p-2 text-left">Ret IVA</th>
                    <th className="p-2 text-left">Ret Renta</th>
                  </tr>
                </thead>

                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.transactionId} className="border-t">
                      <td className="p-2 font-mono text-xs">
                        {doc.documentNumber || "-"}
                      </td>
                      <td className="p-2">{doc.date}</td>
                      <td className="p-2">{formatMoney(doc.base)}</td>
                      <td className="p-2">{formatMoney(doc.ivaRetention)}</td>
                      <td className="p-2">{formatMoney(doc.rentaRetention)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================= */}
        {/* ACTIONS */}
        {/* ========================= */}
        <div className="mt-6 flex justify-end">
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