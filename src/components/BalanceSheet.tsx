// src/components/BalanceSheet.tsx

import React from "react";
import { JournalEntry } from "../types/JournalEntry";
import jsPDF from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";

interface Props {
  entries: JournalEntry[];
}

export default function BalanceSheet({ entries }: Props) {
  const assets = entries.filter(e => e.account_code?.startsWith("1"));
  const liabilities = entries.filter(e => e.account_code?.startsWith("2") || e.account_code?.startsWith("3"));

  const sumAmount = (list: JournalEntry[]) =>
    list.reduce((acc, curr) => acc + (curr.debit || 0) - (curr.credit || 0), 0);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Balance General", 14, 16);

    // Activos
    autoTable(doc, {
      startY: 22,
      head: [["Activo", "Valor"]],
      body: assets.map(e => [e.account_name, `$${(e.debit || 0).toFixed(2)}`]),
    });

    // Pasivo y Patrimonio
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Pasivo y Patrimonio", "Valor"]],
      body: liabilities.map(e => [e.account_name, `$${(e.credit || 0).toFixed(2)}`]),
    });

    // Totales
    doc.setFontSize(12);
    doc.text(
      `Total Activo: $${sumAmount(assets).toFixed(2)}`,
      14,
      doc.lastAutoTable.finalY + 10
    );
    doc.text(
      `Total Pasivo + Patrimonio: $${sumAmount(liabilities).toFixed(2)}`,
      14,
      doc.lastAutoTable.previous.finalY + 18
    );

    doc.save("balance_general.pdf");
  };
  
  return (
    <div>
      <h2 className="text-xl font-semibold text-blue-600 mb-4">Balance General</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-bold text-gray-700 mb-2">Activo</h3>
          <ul className="space-y-1">
            {assets.map((entry, i) => (
              <li key={i} className="flex justify-between text-sm text-gray-600">
                <span>{entry.account_name}</span>
                <span>${(entry.debit || 0).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="font-bold mt-2 border-t pt-2">
            Total Activo: ${sumAmount(assets).toFixed(2)}
          </div>
        </div>

        <div>
          <h3 className="font-bold text-gray-700 mb-2">Pasivo y Patrimonio</h3>
          <ul className="space-y-1">
            {liabilities.map((entry, i) => (
              <li key={i} className="flex justify-between text-sm text-gray-600">
                <span>{entry.account_name}</span>
                <span>${(entry.credit || 0).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="font-bold mt-2 border-t pt-2">
            Total Pasivo + Patrimonio: ${sumAmount(liabilities).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Boton Exportar PDF */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={handleExportPDF}
          className="px-6 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700"
        >
          📄 Exportar PDF
        </button>
      </div>
    </div>
  );
}