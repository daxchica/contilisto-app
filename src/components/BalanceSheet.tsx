// src/components/BalanceSheet.tsx

import React from "react";
import { JournalEntry } from "../types/JournalEntry";
import jsPDF from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";

interface Props {
  entries: JournalEntry[];
}

function groupEntries(entries: JournalEntry[]) {
  const groups: Record<string, { account_name: string; debit: number; credit: number }> = {};

  for (const entry of entries) {
    const code = entry.account_code || "000";
    if (!groups[code]) {
      groups[code] = {
        account_name: entry.account_name || "",
        debit: 0,
        credit: 0,
      };
    }

    groups[code].debit += entry.debit || 0;
    groups[code].credit += entry.credit || 0;
  }

  return groups;
}

export default function BalanceSheet({ entries }: Props) {

  const assets = entries.filter(e => e.account_code?.startsWith("1"));
  const liabilities = entries.filter(e => e.account_code?.startsWith("2"));
  const equity = entries.filter(e => e.account_code?.startsWith("3"));

  const groupedAssets = groupEntries(assets);
  const groupedLiabilities = groupEntries(liabilities);
  const groupedEquity = groupEntries(equity);

  const totalAssets = Object.values(groupedAssets).reduce((acc, e) => acc + (e.debit - e.credit), 0);
  const totalLiabilities = Object.values(groupedLiabilities).reduce((acc, e) => acc + (e.credit - e.debit), 0);
  const totalEquity = Object.values(groupedEquity).reduce((acc, e) => acc + (e.credit - e.debit), 0);
  const totalLiabilitiesEquity = totalLiabilities + totalEquity;
  
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Balance General", 14, 16);

    // Activos
    autoTable(doc, {
      startY: 22,
      head: [["Cuenta", "Nombre", "Valor"]],
      body: Object.entries(groupedAssets).map(([code, group]) => [
        code,
        group.account_name,
        `$${(group.debit - group.credit).toFixed(2)}`,
      ]),
    });

    // Pasivo y Patrimonio
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10 || 40,
      head: [["Cuenta", "Nombre", "Valor"]],
      body: [
        ...Object.entries(groupedLiabilities).map(([code, group]) => [
        code,
        group.account_name,
        `$${(group.credit - group.debit).toFixed(2)}`,
      ]),
      ["", "Total Pasivo", `$${totalLiabilities.toFixed(2)}`],
        ...Object.entries(groupedEquity).map(([code, group]) => [
          code,
          group.account_name,
          `$${(group.credit - group.debit).toFixed(2)}`,
        ]),
        ["", "Total Patrimonio", `$${totalEquity.toFixed(2)}`],
        ["", "Total Pasivo + Patrimonio", `$${totalLiabilitiesEquity.toFixed(2)}`],
      ],
    });

    // Totales
    doc.setFontSize(12);
    doc.text(
      `Total Activo: $${totalAssets.toFixed(2)}`,
      14,
      (doc as any).lastAutoTable.finalY + 10 || 60
    );
    doc.text(
      `Total Pasivo + Patrimonio: $${totalLiabilities.toFixed(2)}`,
      14,
      (doc as any).lastAutoTable.previous.finalY + 18 || 70
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
            {Object.entries(groupedAssets).map(([code, group]) => (
              <li key={code} className="flex justify-between text-sm text-gray-600">
                <span>{code} - {group.account_name}</span>
                <span>${(group.debit - group.credit).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="font-bold mt-2 border-t pt-2">
            Total Activo: ${totalAssets.toFixed(2)}
          </div>
        </div>

        <div>
          <h3 className="font-bold text-gray-700 mb-2">Pasivo y Patrimonio</h3>
          <ul className="space-y-1">
            {Object.entries(groupedLiabilities).map(([code, group]) => (
              <li key={code} className="flex justify-between text-sm text-gray-600">
                <span>{code} - {group.account_name}</span>
                <span>${(group.credit - group.debit).toFixed(2)}</span>
              </li>
            ))}
             <li className="flex justify-between font-bold border-t pt-2">
              <span>Total Pasivo</span>
              <span>${totalLiabilities.toFixed(2)}</span>
            </li>
            {Object.entries(groupedEquity).map(([code, group]) => (
              <li key={code} className="flex justify-between text-sm text-gray-600">
                <span>{code} - {group.account_name}</span>
                <span>${(group.credit - group.debit).toFixed(2)}</span>
              </li>
            ))}
            <li className="flex justify-between font-bold">
              <span>Total Patrimonio</span>
              <span>${totalEquity.toFixed(2)}</span>
            </li>
            <li className="flex justify-between font-bold border-t pt-2">
              <span>Total Pasivo + Patrimonio</span>
              <span>${totalLiabilitiesEquity.toFixed(2)}</span>
            </li>
          </ul>
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