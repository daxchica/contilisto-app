// src/components/invoices/InvoiceItemsTable.tsx
import React, { useCallback } from "react";
import type { InvoiceItem, TaxRate } from "@/types/Invoice";

type Props = {
  items: InvoiceItem[];
  onChange: (items: InvoiceItem[]) => void;
};

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

function round2(n: number) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function recalc(item: InvoiceItem): InvoiceItem {
  const quantity = Math.max(Number(item.quantity) || 0, 0);
  const unitPrice = Math.max(Number(item.unitPrice) || 0, 0);
  const ivaRate = (Math.max(Number(item.ivaRate) || 0, 0) as TaxRate) ?? 0;
  const discount = Math.max(Number(item.discount ?? 0) || 0, 0);

  const base = Math.max(quantity * unitPrice - discount, 0);
  const ivaValue = round2(base * (ivaRate / 100));
  const subtotal = round2(base);
  const total = round2(subtotal + ivaValue);

  return {
    ...item,
    quantity,
    unitPrice,
    ivaRate,
    discount,
    subtotal,
    ivaValue,
    total,
  };
}

export default function InvoiceItemsTable({ items, onChange }: Props) {
  const addItem = useCallback(() => {
    const newItem: InvoiceItem = recalc({
      id: createId(),
      description: "",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      ivaRate: 15,
      ivaValue: 0,
      subtotal: 0,
      total: 0,
    });
    onChange([...(items ?? []), newItem]);
  }, [items, onChange]);

  const updateItem = useCallback(
    (id: string, patch: Partial<InvoiceItem>) => {
      const next = (items ?? []).map((it) =>
        it.id === id ? recalc({ ...it, ...patch } as InvoiceItem) : it
      );
      onChange(next);
    },
    [items, onChange]
  );

  const removeItem = useCallback(
    (id: string) => {
      const next = (items ?? []).filter((it) => it.id !== id);
      onChange(next.length ? next : []);
    },
    [items, onChange]
  );

  return (
    <div className="space-y-3">
      <div className="w-full overflow-x-auto">
        <table className="min-w-[760px] w-full border rounded-lg">
          <thead className="bg-gray-100 text-sm text-gray-600">
            <tr>
              <th className="p-2 text-left">Descripción</th>
              <th className="p-2 text-center">Cant.</th>
              <th className="p-2 text-center">P. Unit.</th>
              <th className="p-2 text-center">IVA</th>
              <th className="p-2 text-center">Subtotal</th>
              <th className="p-2 text-center">IVA</th>
              <th className="p-2 text-center">Total</th>
              <th className="p-2"></th>
            </tr>
          </thead>

          <tbody>
            {(items ?? []).map((it) => (
              <tr key={it.id} className="border-t">
                <td className="p-2">
                  <input
                    className="w-full border rounded px-2 py-1"
                    value={it.description}
                    onChange={(e) =>
                      updateItem(it.id, { description: e.target.value })
                    }
                    placeholder="Ej: SERVICIOS PROFESIONALES"
                  />
                </td>

                <td className="p-2 text-center">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    className="w-20 border rounded px-2 py-1 text-center"
                    value={it.quantity}
                    onChange={(e) =>
                      updateItem(it.id, { quantity: Number(e.target.value) })
                    }
                  />
                </td>

                <td className="p-2 text-center">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-28 border rounded px-2 py-1 text-center"
                    value={it.unitPrice === 0 ? "" : it.unitPrice}
                    onChange={(e) =>
                      updateItem(it.id, {
                        unitPrice:
                          e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    placeholder="0.00"
                  />
                </td>

                <td className="p-2 text-center">
                  <select
                    value={it.ivaRate}
                    className="border rounded px-2 py-1"
                    onChange={(e) =>
                      updateItem(it.id, {
                        ivaRate: Number(e.target.value) as TaxRate,
                      })
                    }
                  >
                    <option value={0}>0%</option>
                    <option value={12}>12%</option>
                    <option value={15}>15%</option>
                  </select>
                </td>

                <td className="p-2 text-center font-semibold">
                  ${Number(it.subtotal ?? 0).toFixed(2)}
                </td>
                <td className="p-2 text-center font-semibold">
                  ${Number(it.ivaValue ?? 0).toFixed(2)}
                </td>
                <td className="p-2 text-center font-semibold">
                  ${Number(it.total ?? 0).toFixed(2)}
                </td>

                <td className="p-2 text-center">
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}

            {(items ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-sm text-gray-500">
                  Agrega un ítem para empezar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addItem}
        className="px-4 py-2 bg-[#0A3558] text-white rounded-lg"
      >
        + Agregar ítem
      </button>
    </div>
  );
}