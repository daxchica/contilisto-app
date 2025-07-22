import React from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { JournalEntry } from "../types/JournalEntry";

interface Props {
  entries: JournalEntry[];
  entityName: string;
  onSave: () => void;
}

export default function JournalTable({ entries, entityName, onSave }: Props) {
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text(`Journal Report - ${entityName}`, 14, 16);

    autoTable(doc, {
      head: [["Fecha", "Factura", "Código", "Cuenta", "Débito", "Crédito"]],
      body: entries.map((e) => [
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

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Registros de Diario</h2>
        <div className="space-x-2">
          <button
            onClick={onSave}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            💾 Grabar Diario
          </button>
          <button
            onClick={exportToPDF}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            📄 Exportar a PDF
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 border">Fecha</th>
              <th className="p-2 border">Nro. de Fact.</th>
              <th className="p-2 border">Código de Cuenta</th>
              <th className="p-2 border">Nombre de Cuenta</th>
              <th className="p-2 border">Débito</th>
              <th className="p-2 border">Crédito</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index}>
                <td className="p-2 border">{entry.date}</td>
                <td className="p-2 border">{entry.invoice_number || "_"}</td>
                <td className="p-2 border">{entry.account_code}</td>
                <td className="p-2 border">{entry.account_name}</td>
                <td className="p-2 border text-right">
                  {entry.debit?.toLocaleString()}
                </td>
                <td className="p-2 border text-right">
                  {entry.credit?.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}