// src/components/invoice/InvoiceItemsTable.tsx
import React from "react";
import type { InvoiceItem } from "@/types/InvoiceItem";

interface Props {
  items: InvoiceItem[];
  onChange: (updated: InvoiceItem[]) => void;
}

// Campos que el usuario puede editar manualmente
type EditableInvoiceItemField =
  | "description"
  | "quantity"
  | "unitPrice"
  | "discount"
  | "ivaRate";

// Recalcula todos los campos derivados de un ítem
function recalc(item: InvoiceItem): InvoiceItem {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  const ivaRate = Number(item.ivaRate) || 0;
  const discount = Number(item.discount ?? 0) || 0;;
  
  const base = item.quantity * item.unitPrice - discount;
  const ivaValue = base * (item.ivaRate / 100);
  const subtotal = base;
  const total = subtotal + ivaValue;

  return {
    ...item,
    quantity,
    unitPrice,
    ivaRate,
    discount,
    ivaValue,
    subtotal,
    total,
  };
}

export default function InvoiceItemsTable({ items, onChange }: Props) {
  // -----------------------------
  // Add new item
  // -----------------------------
  const addItem = () => {
    const baseItem: InvoiceItem = recalc({
      id: crypto.randomUUID(),
      description: "",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      ivaRate: 12,
      ivaValue: 0,
      subtotal: 0,
      total: 0,
    });
    onChange([...items, baseItem]);
  };

  // -----------------------------
  // Update an item
  // -----------------------------
  const updateItem = (
    id: string, 
    field: keyof InvoiceItem, 
    value: string | number
  ) => {
    const updated = items.map((item) => {
      if (item.id !== id) return item;

      const next: InvoiceItem = {  
        ...item, 
        [field]: value,
       } as InvoiceItem;
      
       return recalc(next);
    });
    onChange(updated);
  };

  // -----------------------------
  // Remove an item
  // -----------------------------
  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  // ----------------
  // Totals summary
  // ----------------
  const subtotal0 = items
    .filter((i) => Number(i.ivaRate) === 0)
    .reduce((sum, i) => sum + i.subtotal, 0);

  const subtotal12 = items
    .filter((i) => Number(i.ivaRate) === 12)
    .reduce((sum, i) => sum + i.subtotal, 0);

  const subtotalTaxable = items
    .filter((i) => Number(i.ivaRate) !== 0)
    .reduce((sum, i) => sum + Number(i.subtotal), 0);

  const iva = items.reduce((sum, i) => sum + Number(i.ivaValue), 0);
  const total = items.reduce((sum, i) => sum + Number(i.total), 0);

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
          {items.map((item) => (
              <tr key={item.id} className="border-t">
                {/* Description */}
                <td className="p-2">
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1"
                    value={item.description}
                    onChange={(e) =>
                      updateItem(item.id, "description", e.target.value)
                    }
                  />
                </td>

                {/* Quantity */}
                <td className="p-2 text-center">
                  <input
                    type="number"
                    className="w-20 border rounded px-2 py-1 text-center"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(item.id, "quantity", Number(e.target.value))
                    }
                  />
                </td>

                {/* Unit Pricee */}
                <td className="p-2 text-center">
                  <input
                    type="number"
                    className="w-24 border rounded px-2 py-1 text-center"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateItem(item.id, "unitPrice", Number(e.target.value))
                    }
                  />
                </td>

                {/* TAX */}
                <td className="p-2 text-center">
                  <select
                    className="border rounded px-2 py-1"
                    value={item.ivaRate}
                    onChange={(e) =>
                      updateItem(item.id, "ivaRate", Number(e.target.value))
                    }
                  >
                    <option value={15}>15%</option>
                    <option value={12}>12%</option>
                    <option value={0}>0%</option>
                  </select>
                </td>

                {/* Subtotal */}
                <td className="p-2 text-center font-semibold">
                  ${item.subtotal.toFixed(2)}
                </td>

                {/* Remove */}
                <td className="p-2 text-center">
                  <button
                    className="text-red-500 hover:text-red-700"
                    onClick={() => removeItem(item.id)}
                    type="button"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
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