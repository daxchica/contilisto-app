// ============================================================================
// src/components/sri/AtsPreviewModal.tsx
// CONTILISTO — ATS Preview Modal
// Shows ATS documents before exporting XML
// ============================================================================

import React from "react";
import type { AtsDocument } from "@/types/atsDocument";

type Props = {
  open: boolean;
  documents: AtsDocument[];
  onClose: () => void;
  onExportXml: () => void;
};

const fmt = (n?: number) =>
  new Intl.NumberFormat("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));

export default function AtsPreviewModal({
  open,
  documents,
  onClose,
  onExportXml,
}: Props) {
  if (!open) return null;

  const totalBase12 = documents.reduce((a, d) => a + (d.base12 ?? 0), 0);
  const totalBase0 = documents.reduce((a, d) => a + (d.base0 ?? 0), 0);
  const totalIva = documents.reduce((a, d) => a + (d.iva ?? 0), 0);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

      <div className="bg-white w-[1100px] max-h-[80vh] overflow-auto rounded-xl shadow-lg p-6">

        <h2 className="text-xl font-bold text-[#0A3558] mb-4">
          ATS Preview
        </h2>

        <table className="w-full text-sm border">

          <thead className="bg-gray-100">

            <tr>
              <th className="border p-2">Tipo</th>
              <th className="border p-2">RUC</th>
              <th className="border p-2">Razón Social</th>
              <th className="border p-2">Documento</th>
              <th className="border p-2">Fecha</th>
              <th className="border p-2 text-right">Base 12%</th>
              <th className="border p-2 text-right">Base 0%</th>
              <th className="border p-2 text-right">IVA</th>
            </tr>

          </thead>

          <tbody>

            {documents.map((doc) => {

              const tipo =
                doc.documentType === "01"
                  ? "Compra"
                  : doc.documentType === "18"
                  ? "Venta"
                  : "Retención";

              return (
                <tr key={doc.id}>

                  <td className="border p-2">{tipo}</td>

                  <td className="border p-2 font-mono">{doc.ruc}</td>

                  <td className="border p-2">{doc.razonSocial}</td>

                  <td className="border p-2 font-mono">
                    {doc.establishment}-{doc.emissionPoint}-{doc.sequential}
                  </td>

                  <td className="border p-2">{doc.date}</td>

                  <td className="border p-2 text-right">
                    {fmt(doc.base12)}
                  </td>

                  <td className="border p-2 text-right">
                    {fmt(doc.base0)}
                  </td>

                  <td className="border p-2 text-right">
                    {fmt(doc.iva)}
                  </td>

                </tr>
              );
            })}

          </tbody>

          <tfoot className="bg-gray-100 font-semibold">

            <tr>

              <td className="border p-2" colSpan={5}>
                Totales
              </td>

              <td className="border p-2 text-right">
                {fmt(totalBase12)}
              </td>

              <td className="border p-2 text-right">
                {fmt(totalBase0)}
              </td>

              <td className="border p-2 text-right">
                {fmt(totalIva)}
              </td>

            </tr>

          </tfoot>

        </table>

        <div className="flex justify-end gap-3 mt-6">

          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancelar
          </button>

          <button
            onClick={onExportXml}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Exportar XML
          </button>

        </div>

      </div>

    </div>
  );
}