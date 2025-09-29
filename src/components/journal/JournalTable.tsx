// src/components/JournalTable.tsx
import React, { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { JournalEntry } from "@/types/JournalEntry";

interface Props {
  entries: JournalEntry[];
  entityName?: string;
  onSave?: () => void;
  onSelectEntries?: (selected: JournalEntry[]) => void;
}

export default function JournalTable({
  entries,
  entityName,
  onSave,
  onSelectEntries,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (onSelectEntries) {
      const selected = entries.filter((entry, idx) =>
        selectedIds.includes(entry.id || idx.toString())
      );
      onSelectEntries(selected);
    }
  }, [selectedIds, entries, onSelectEntries]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const allIds = entries.map((entry, idx) => entry.id || idx.toString());
    setSelectedIds(
      selectedIds.length === entries.length ? [] : allIds
    );
  };

  const exportToPDF = () => {
    const selectedEntries =
      selectedIds.length > 0
        ? entries.filter((entry, idx) =>
            selectedIds.includes(entry.id || idx.toString())
          )
        : entries;

    if (selectedEntries.length === 0) {
      alert("No hay registros para exportar.");
      return;
    }

    const doc = new jsPDF();
    doc.text(`Registros de Diario - ${entityName || "Entidad"}`, 14, 16);

    autoTable(doc, {
      head: [["Fecha", "Factura", "Código", "Cuenta", "Débito", "Crédito"]],
      body: selectedEntries.map((e) => [
        e.date,
        e.invoice_number || "_",
        e.account_code,
        e.account_name,
        e.debit?.toFixed(2) || "0.00",
        e.credit?.toFixed(2) || "0.00",
      ]),
      startY: 22,
    });

    doc.save("registros-diario.pdf");
  };

  return (
    <div className="mt-8">
      <div className="w-full mb-4">
        <h2 className="text-xl font-semibold text-center">
          Registros de Diario
        </h2>
        <div className="flex justify-between items-center px-4 mt-2">
          <div className="text-sm text-gray-700">
            Seleccionados: {selectedIds.length} / {entries.length}
          </div>
          <button
            onClick={exportToPDF}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            📄 Exportar a PDF
          </button>
        </div>
      </div>

      <div className="p-4 max-w-screen-xl mx-auto overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-200 text-sm">
              <th className="p-2 border text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.length === entries.length && entries.length > 0}
                  onChange={toggleSelectAll}
                  title="checkbox"
                />
              </th>
              <th className="p-2 border">Fecha</th>
              <th className="p-2 border">Factura</th>
              <th className="p-2 border">Código</th>
              <th className="p-2 border">Cuenta</th>
              <th className="p-2 border">Débito</th>
              <th className="p-2 border">Crédito</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => {
              const id = entry.id || index.toString();
              const isSelected = selectedIds.includes(id);

              return (
                <tr
                  key={id}
                  onClick={() => toggleSelect(id)}
                  className={`cursor-pointer text-sm ${isSelected ? "bg-yellow-100" : "hover:bg-gray-50"}`}
                >
                  <td className="p-2 border text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(id)}
                      onClick={(e) => e.stopPropagation()}
                      title="toggling"
                    />
                  </td>
                  <td className="p-2 border">{entry.date}</td>
                  <td className="p-2 border">{entry.invoice_number || "_"}</td>
                  <td className="p-2 border">{entry.account_code}</td>
                  <td className="p-2 border">{entry.account_name}</td>
                  <td
                    className={`p-2 border text-right ${
                      entry.debit && entry.debit < 0 ? "text-red-500" : ""
                    }`}
                  >
                    {entry.debit?.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || "0.00"}
                  </td>
                  <td
                    className={`p-2 border text-right ${
                      entry.credit && entry.credit < 0 ? "text-red-500" : ""
                    }`}
                  >
                    {entry.credit?.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || "0.00"}
                  </td>
                </tr>
              );
            })}
        </tbody>
        </table>
      </div>
    </div>
  );
}