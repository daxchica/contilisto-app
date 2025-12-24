// src/components/invoice/InvoiceItemsTable.tsx
import React, { useCallback, useMemo } from "react";
import type { InvoiceItem } from "@/types/InvoiceItem";

interface Props {
  items: InvoiceItem[];
  onChange: (updated: InvoiceItem[]) => void;
}

/* ---------------------------------------------
   Safe ID generator (Safari / SSR compatible)
--------------------------------------------- */
const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

/* ---------------------------------------------
   Recalculate derived fields
--------------------------------------------- */
function recalc(item: InvoiceItem): InvoiceItem {
  const quantity = Math.max(Number(item.quantity) || 0, 0);
  const unitPrice = Math.max(Number(item.unitPrice) || 0, 0);
  const ivaRate = Math.max(Number(item.ivaRate) || 0, 0);
  const discount = Math.max(Number(item.discount ?? 0) || 0, 0);

  const base = Math.max(quantity * unitPrice - discount, 0);
  const ivaValue = base * (ivaRate / 100);
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
  /* ---------------------------------------------
     Add item
  --------------------------------------------- */
  const addItem = useCallback(() => {
    const newItem: InvoiceItem = recalc({
      id: createId(),
      description: "",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      ivaRate: 12,
      ivaValue: 0,
      subtotal: 0,
      total: 0,
    });

    onChange([...items, newItem]);
  }, [items, onChange]);

  /* ---------------------------------------------
     Update item
  --------------------------------------------- */
  const updateItem = useCallback(
    (id: string, field: keyof InvoiceItem, value: string | number) => {
      const updated = items.map((item) => {
        if (item.id !== id) return item;

        const next: InvoiceItem = {
          ...item,
          [field]: value,
        } as InvoiceItem;

        return recalc(next);
      });

      onChange(updated);
    },
    [items, onChange]
  );

  /* ---------------------------------------------
     Remove item
  --------------------------------------------- */
  const removeItem = useCallback(
    (id: string) => {
      onChange(items.filter((item) => item.id !== id));
    },
    [items, onChange]
  );

  /* ---------------------------------------------
     Totals (memoized)
  --------------------------------------------- */
  const totals = useMemo(() => {
    const subtotal0 = items
      .filter((i) => Number(i.ivaRate) === 0)
      .reduce((sum, i) => sum + i.subtotal, 0);

    const subtotal12 = items
      .filter((i) => Number(i.ivaRate) === 12)
      .reduce((sum, i) => sum + i.subtotal, 0);

    const iva = items.reduce((sum, i) => sum + Number(i.ivaValue), 0);
    const total = items.reduce((sum, i) => sum + Number(i.total), 0);

    return { subtotal0, subtotal12, iva, total };
  }, [items]);

  return (
    <div className="space-y-4">
      {/* =======================
          MOBILE VIEW (cards)
      ======================= */}
      <div className="md:hidden space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="border rounded-xl p-4 bg-white shadow-sm space-y-3"
          >
            <input
              aria-label="Descripción del ítem"
              type="text"
              placeholder="Descripción"
              className="w-full border rounded px-3 py-2"
              value={item.description}
              onChange={(e) =>
                updateItem(item.id, "description", e.target.value)
              }
            />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="text-gray-500">Cantidad</label>
                <input
                  type="number"
                  min={1}
                  className="border rounded px-3 py-2 text-center w-full"
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(item.id, "quantity", Number(e.target.value))
                  }
                />
              </div>

              <div>
                <label className="text-gray-500">P. Unitario</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="border rounded px-3 py-2 text-center w-full"
                  value={item.unitPrice === 0 ? "": item.unitPrice}
                  onChange={(e) =>
                    updateItem(item.id, "unitPrice", e.target.value === "" ? 0 : Number(e.target.value))
                  }
                />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <select
                className="border rounded px-3 py-2"
                value={item.ivaRate}
                onChange={(e) =>
                  updateItem(item.id, "ivaRate", Number(e.target.value))
                }
              >
                <option value={12}>12%</option>
                <option value={0}>0%</option>
                <option value={15}>15%</option>
              </select>

              <span className="font-semibold">
                ${item.subtotal.toFixed(2)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="text-red-600 text-sm active:scale-95 transition"
            >
              Eliminar ítem
            </button>
          </div>
        ))}
      </div>

      {/* =======================
          DESKTOP TABLE
      ======================= */}
      <div className="w-full overflow-x-auto hidden md:block">
        <table className="min-w-[680px] w-full border rounded-lg">
          <thead className="bg-gray-100 text-sm text-gray-600">
            <tr>
              <th className="p-2 text-left whitespace-nowrap">Descripción</th>
              <th className="p-2 text-center whitespace-nowrap">Cant.</th>
              <th className="p-2 text-center whitespace-nowrap">P. Unit.</th>
              <th className="p-2 text-center whitespace-nowrap">IVA</th>
              <th className="p-2 text-center whitespace-nowrap">Subtotal</th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
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

                <td className="p-2 text-center">
                  <input
                    type="number"
                    className="w-24 border rounded px-2 py-1 text-center"
                    min={0}
                    step="0.01"
                    value={item.unitPrice === 0 ? "" : item.unitPrice}
                    onChange={(e) =>
                      updateItem(item.id, "unitPrice", e.target.value === "" ? 0 : Number(e.target.value))
                    }
                  />
                </td>

                <td className="p-2 text-center">
                  <select
                    className="border rounded px-2 py-1"
                    value={item.ivaRate}
                    onChange={(e) =>
                      updateItem(item.id, "ivaRate", Number(e.target.value))
                    }
                  >
                    <option value={12}>12%</option>
                    <option value={0}>0%</option>
                    <option value={15}>15%</option>
                  </select>
                </td>

                <td className="p-2 text-center font-semibold">
                  ${item.subtotal.toFixed(2)}
                </td>

                <td className="p-2 text-center">
                  <button
                    type="button"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => removeItem(item.id)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ADD ITEM */}
      <button
        type="button"
        onClick={addItem}
        className="px-4 py-2 bg-[#0A3558] text-white rounded-lg hover:bg-[#0d4470]"
      >
        + Agregar Ítem
      </button>
    </div>
  );
}