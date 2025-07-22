// src/components/JournalPreviewModal.tsx

import React, { useEffect, useState } from "react";
import { JournalEntry } from "../types/JournalEntry";

interface Props {
  entries: JournalEntry[];
  onCancel: () => void;
  onSave: (confirmed: JournalEntry[]) => void;
}

export default function JournalPreviewModal({ entries, onCancel, onSave }: Props) {
  const [adjustedEntries, setAdjustedEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
  const updated = entries.map((e) => {
    let updatedEntry = { ...e };

    // Corrige "Caja" a "Cuentas por cobrar"
    if (
      e.type === "income" &&
      e.account_code === "11101" &&
      e.account_name === "Caja"
    ) {
      updatedEntry.account_code = "14301";
      updatedEntry.account_name = "Cuentas por cobrar comerciales locales";
      updatedEntry.description = "Cuenta por cobrar por factura de venta";
    }

    // Revisa si es venta y mal puesta como débito
    if (
      e.type === "income" &&
      e.account_code === "70101" &&
      e.account_name === "Ventas locales" &&
      e.debit && e.debit > 0
    ) {
      updatedEntry.credit = e.debit;
      updatedEntry.debit = undefined;
    }

    return updatedEntry;
  });

  setAdjustedEntries(updated);
}, [entries]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-5xl w-full">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          🧾 Previsualización de Asientos Contables
        </h2>

        <div className="max-h-[60vh] overflow-auto border rounded">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr className="text-gray-700 text-xs uppercase border-b">
                <th className="p-2 border">Fecha</th>
                <th className="p-2 border">Descripción</th>
                <th className="p-2 border">Código</th>
                <th className="p-2 border">Cuenta</th>
                <th className="p-2 border text-right">Debe</th>
                <th className="p-2 border text-right">Haber</th>
                <th className="p-2 border">Tipo</th>
                <th className="p-2 border">Factura</th>
              </tr>
            </thead>
            <tbody>
              {adjustedEntries.map((e, idx) => (
                <tr key={idx} className="hover:bg-gray-50 border-t">
                  <td className="p-2 border">{e.date}</td>
                  <td className="p-2 border">{e.description}</td>
                  <td className="p-2 border">{e.account_code}</td>
                  <td className="p-2 border">{e.account_name}</td>
                  <td className="p-2 border text-right">
                    {e.debit !== undefined ? e.debit.toFixed(2) : ""}
                  </td>
                  <td className="p-2 border text-right">
                    {e.credit !== undefined ? e.credit.toFixed(2) : ""}
                  </td>
                  <td className="p-2 border">{e.type}</td>
                  <td className="p-2 border">{e.invoice_number || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(adjustedEntries)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            ✅ Confirmar Asientos
          </button>
        </div>
      </div>
    </div>
  );
}