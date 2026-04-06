import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  summary: any;
};

export default function Ret103PreviewModal({
  open,
  onClose,
  summary,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">

      <div className="bg-white rounded-xl shadow-xl w-[500px] p-6">

        <h2 className="text-xl font-bold text-[#0A3558] mb-4">
          Formulario 103 - Retenciones
        </h2>

        <div className="space-y-2 text-sm">

          <div className="flex justify-between">
            <span>Retenciones IVA</span>
            <span>${summary.ivaRetenido.toFixed(2)}</span>
          </div>

          <div className="flex justify-between">
            <span>Retenciones Renta</span>
            <span>${summary.rentaRetenida.toFixed(2)}</span>
          </div>

          <hr />

          <div className="flex justify-between font-bold">
            <span>Total a declarar</span>
            <span>${summary.totalRetenciones.toFixed(2)}</span>
          </div>

        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded"
          >
            Cerrar
          </button>
        </div>

      </div>

    </div>
  );
}