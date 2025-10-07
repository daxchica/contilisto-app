import React, { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { JournalEntry } from "../types/JournalEntry";

interface Props {
  entries: JournalEntry[];
  entityName: string;
  onSave: (entries: JournalEntry[]) => void;
  onDeleteSelected?: (ids: string[]) => void;
}

type SortKey = "date" | "invoice_number" | "account_code" | "account_name" | "debit" | "credit";

export default function JournalTable({ entries, entityName, onSave, onDeleteSelected }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const allIds = entries.map((entry, idx) => entry.id || idx.toString());
    setSelectedIds(selectedIds.length === entries.length ? [] : allIds);
  };

  const exportToPDF = () => {
    const selectedEntries =
      selectedIds.length > 0
        ? entries.filter((entry, idx) =>
            selectedIds.includes(entry.id || idx.toString())
          )
        : entries;

    const doc = new jsPDF();
    doc.text(`Journal Report - ${entityName}`, 14, 16);
    autoTable(doc, {
      head: [["Fecha", "Factura", "Código", "Cuenta", "Débito", "Crédito"]],
      body: selectedEntries.map((e) => [
        e.date,
        e.invoice_number || "_",
        e.account_code,
        e.account_name,
        e.debit?.toFixed(2) || "",
        e.credit?.toFixed(2) || "",
      ]),
      startY: 22,
    });
    doc.save("journal.pdf");
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) {
      alert("No hay registros seleccionados.");
      return;
    }
    const confirmDelete = window.confirm("¿Deseas eliminar los registros seleccionados?");
    if (!confirmDelete) return;
    
    if (onDeleteSelected) {
      onDeleteSelected(selectedIds);
    } else {
      const remaining = entries.filter(
        (entry) => !selectedIds.includes(entry.id || "")
      );
      onSave(remaining);
    }

    setSelectedIds([]);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const sortedEntries = [...entries].sort((a, b) => {
    const valA = a[sortKey] ?? "";
    const valB = b[sortKey] ?? "";
    if (typeof valA === "number" && typeof valB === "number") {
      return sortOrder === "asc" ? valA - valB : valB - valA;
    } else {
      return sortOrder === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    }
  });

  return (
    <div className="mt-8">
      <div className="w-full mt-8 mb-2">
        <h2 className="text-xl font-semibold text-center">Registros de Diario</h2>
        <div className="flex flex-wrap justify-between items-center px-4 mb-4">
          <div className="text-sm text-gray-700">
            Seleccionados: {selectedIds.length} / {entries.length}
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToPDF}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              📄 Exportar a PDF
            </button>
            <button
              onClick={handleDeleteSelected}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              🗑️ Eliminar seleccionados
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-screen-xl mx-auto overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 border text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.length === entries.length && entries.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              {[
                ["date", "Fecha"],
                ["invoice_number", "Nro. de Fact."],
                ["account_code", "Código de Cuenta"],
                ["account_name", "Nombre de Cuenta"],
                ["debit", "Débito"],
                ["credit", "Crédito"],
              ].map(([key, label]) => (
                <th
                  key={key}
                  className="p-2 border cursor-pointer select-none hover:bg-gray-300"
                  onClick={() => handleSort(key as SortKey)}
                >
                  {label}
                  {sortKey === key && (sortOrder === "asc" ? " ▲" : " ▼")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((entry, index) => {
              const id = entry.id || index.toString();
              const isSelected = selectedIds.includes(id);
              return (
                <tr
                  key={id}
                  onClick={() => toggleSelect(id)}
                  className={`text-sm cursor-pointer ${
                    isSelected ? "bg-yellow-100" : "hover:bg-gray-50"
                  }`}
                >
                  <td className="p-2 border text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="p-2 border">{entry.date}</td>
                  <td className="p-2 border">{entry.invoice_number || "_"}</td>
                  <td className="p-2 border">{entry.account_code}</td>
                  <td className="p-2 border">{entry.account_name}</td>
                  <td className="p-2 border text-right">
                    {entry.debit?.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || "0.00"}
                  </td>
                  <td className="p-2 border text-right">
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