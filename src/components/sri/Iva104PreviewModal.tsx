import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  summary: any;
};

export default function Iva104PreviewModal({
  open,
  onClose,
  summary
}: Props) {

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">

      <div className="bg-white rounded-xl shadow-xl w-[500px] p-6">

        <h2 className="text-xl font-bold text-[#0A3558] mb-4">
          Formulario 104 - IVA
        </h2>

        <div className="space-y-2 text-sm">

          <div className="flex justify-between">
            <span>Ventas gravadas 12%</span>
            <span>${summary.ventas12?.toFixed(2)}</span>
          </div>

          <div className="flex justify-between">
            <span>IVA en ventas</span>
            <span>${summary.ivaVentas?.toFixed(2)}</span>
          </div>

          <div className="flex justify-between">
            <span>Compras gravadas 12%</span>
            <span>${summary.compras12?.toFixed(2)}</span>
          </div>

          <div className="flex justify-between">
            <span>IVA crédito tributario</span>
            <span>${summary.ivaCompras?.toFixed(2)}</span>
          </div>

          <hr />

          <div className="flex justify-between font-bold">
            <span>IVA a pagar</span>
            <span>
              ${(summary.ivaVentas - summary.ivaCompras).toFixed(2)}
            </span>
          </div>

        </div>

        <div className="mt-6 flex justify-end gap-2">

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