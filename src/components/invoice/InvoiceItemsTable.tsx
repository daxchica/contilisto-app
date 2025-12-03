// src/components/invoice/InvoiceItemsTable.tsx
import React, { useState } from "react";

export interface InvoiceItem {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  ivaPorcentaje: number; // 0 or 12
}

interface Props {
  items: InvoiceItem[];
  onChange: (updated: InvoiceItem[]) => void;
}

export default function InvoiceItemsTable({ items, onChange }: Props) {
  const addItem = () => {
    const newItem: InvoiceItem = {
      id: crypto.randomUUID(),
      descripcion: "",
      cantidad: 1,
      precioUnitario: 0,
      ivaPorcentaje: 12,
    };
    onChange([...items, newItem]);
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    onChange(updated);
  };

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const subtotal0 = items
    .filter((i) => i.ivaPorcentaje === 0)
    .reduce((sum, i) => sum + i.cantidad * i.precioUnitario, 0);

  const subtotal12 = items
    .filter((i) => i.ivaPorcentaje === 12)
    .reduce((sum, i) => sum + i.cantidad * i.precioUnitario, 0);

  const iva = subtotal12 * 0.12;
  const total = subtotal0 + subtotal12 + iva;

  return (
    <div>
      <table className="w-full border rounded-lg">
        <thead className="bg-gray-100 text-sm text-gray-600">
          <tr>
            <th className="p-2 text-left">Descripción</th>
            <th className="p-2 text-center">Cant.</th>
            <th className="p-2 text-center">P. Unitario</th>
            <th className="p-2 text-center">IVA</th>
            <th className="p-2 text-center">Subtotal</th>
            <th className="p-2"></th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => {
            const subtotal = item.cantidad * item.precioUnitario;

            return (
              <tr key={item.id} className="border-t">
                <td className="p-2">
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1"
                    value={item.descripcion}
                    onChange={(e) =>
                      updateItem(item.id, "descripcion", e.target.value)
                    }
                  />
                </td>

                <td className="p-2 text-center">
                  <input
                    type="number"
                    className="w-20 border rounded px-2 py-1 text-center"
                    min={1}
                    value={item.cantidad}
                    onChange={(e) =>
                      updateItem(item.id, "cantidad", Number(e.target.value))
                    }
                  />
                </td>

                <td className="p-2 text-center">
                  <input
                    type="number"
                    className="w-24 border rounded px-2 py-1 text-center"
                    min={0}
                    step="0.01"
                    value={item.precioUnitario}
                    onChange={(e) =>
                      updateItem(item.id, "precioUnitario", Number(e.target.value))
                    }
                  />
                </td>

                <td className="p-2 text-center">
                  <select
                    className="border rounded px-2 py-1"
                    value={item.ivaPorcentaje}
                    onChange={(e) =>
                      updateItem(item.id, "ivaPorcentaje", Number(e.target.value))
                    }
                  >
                    <option value={12}>12%</option>
                    <option value={0}>0%</option>
                  </select>
                </td>

                <td className="p-2 text-center font-semibold">
                  ${subtotal.toFixed(2)}
                </td>

                <td className="p-2 text-center">
                  <button
                    className="text-red-500 hover:text-red-700"
                    onClick={() => removeItem(item.id)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ADD ITEM BUTTON */}
      <button
        onClick={addItem}
        className="mt-4 px-4 py-2 bg-[#0A3558] text-white rounded-lg hover:bg-[#0d4470]"
      >
        + Agregar Ítem
      </button>

      {/* TOTALS SUMMARY */}
      <div className="mt-6 bg-gray-50 p-4 rounded-lg border text-sm w-full md:w-1/2">
        <div className="flex justify-between py-1">
          <span>Subtotal 0%:</span>
          <strong>${subtotal0.toFixed(2)}</strong>
        </div>

        <div className="flex justify-between py-1">
          <span>Subtotal 12%:</span>
          <strong>${subtotal12.toFixed(2)}</strong>
        </div>

        <div className="flex justify-between py-1">
          <span>IVA (12%):</span>
          <strong>${iva.toFixed(2)}</strong>
        </div>

        <hr className="my-2" />

        <div className="flex justify-between py-1 text-lg text-[#0A3558]">
          <span>Total:</span>
          <strong>${total.toFixed(2)}</strong>
        </div>
      </div>
    </div>
  );
}