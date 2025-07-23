// components/PnLSummary.tsx

import React, { useMemo, useState, useEffect } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { JournalEntry } from "../types/JournalEntry";

interface Props {
  entries: JournalEntry[];
}

export default function PnLSummary({ entries }: Props) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (!startDate && !endDate) return true;
      const entryDate = new Date(entry.date);
      const afterStart = startDate ? entryDate >= new Date(startDate) : true;
      const beforeEnd = endDate ? entryDate <= new Date(endDate) : true;
      return afterStart && beforeEnd;
    });
  }, [entries, startDate, endDate]);

  const ventas: number = filteredEntries 
    .filter((e): e is JournalEntry & {account_code: string} => e.account_code === "70101")
    .reduce((sum, e) => sum + (e.credit || 0), 0);

  const compras: number = filteredEntries
    .filter((e): e is JournalEntry & {account_code: string} => e.account_code === "60601")
    .reduce((sum, e) => sum + (e.debit || 0), 0);

  const ice: number = filteredEntries
    .filter((e): e is JournalEntry & {account_code: string} => e.account_code === "53901")
    .reduce((sum, e) => sum + (e.debit || 0), 0);

  const ivaCredito: number = filteredEntries
    .filter((e): e is JournalEntry & {account_code: string} => e.account_code === "24301")
    .reduce((sum, e) => sum + (e.debit || 0), 0);

  const utilidadBruta: number = ventas - (compras + ice + ivaCredito);
  const gastos: number = 0; // Placeholder for now
  const utilidadNeta: number = utilidadBruta - gastos;

  const exportToPDF = () => {
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString();
    let y = 20;

    doc.setFontSize(16);
    doc.text("📊 Estado de Pérdidas y Ganancias", 14, y);
    y += 8;
    doc.setFontSize(11);
    doc.text(`Periodo: ${startDate} al ${endDate}`, 14, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.text("Ingresos operacionales:", 14, y);
    doc.setFont("helvetica", "normal");
    y += 6;
    doc.text(`Ventas locales ....................................... $${ventas.toFixed(2)}`, 14, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.text("(-) Costo de Ventas:", 14, y);
    doc.setFont("helvetica", "normal");
    y += 6;
    doc.text(`Compras locales ...................................... $${compras.toFixed(2)}`, 14, y);
    y += 6;
    doc.text(`Otros tributos (ICE) ................................ $${ice.toFixed(2)}`, 14, y);
    y += 6;
    doc.text(`IVA crédito tributario .............................. $${ivaCredito.toFixed(2)}`, 14, y);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text(`Total Costo de Ventas .................................. $${(compras + ice + ivaCredito).toFixed(2)}`, 14, y);
    y += 10;

    doc.text(`= Utilidad Bruta ....................................... $${utilidadBruta.toFixed(2)}`, 14, y);
    y += 10;
    doc.text(`(-) Gastos Operacionales:                              $${gastos.toFixed(2)}`, 14, y);
    y += 10;
    doc.text(`= Utilidad Neta del Ejercicio ......................... $${utilidadNeta.toFixed(2)}`, 14, y);

    doc.save("Estado_Perdidas_Ganancias.pdf");
  };

  useEffect(() => {
    (window as any).exportPnLPDF = exportToPDF;
    return () => {
      delete (window as any).exportPnLPDF;
    };
  }, [exportToPDF]);

  return (
    <div className="mt-8 bg-white p-4 shadow rounded border">
      <h2 className="text-xl font-bold text-blue-800 mb-4">📈 Estado de Pérdidas y Ganancias</h2>

      <div className="flex flex-wrap gap-4 mb-4">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border p-2 rounded"
          title="Fecha de Inicio"
          aria-label="Fecha de inicio"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border p-2 rounded"
          title="Fecha de fin"
          aria-label="Fecha de fin"
        />
      </div>

      <div className="space-y-1 font-mono text-sm">
        <div className="flex justify-between">
          <span>Ventas locales</span>
          <span>${ventas.toFixed(2)}</span>
        </div>

        <div className="flex justify-between font-semibold mt-2">
          <span>Costos de Ventas:</span>
          <span>-${(compras + ice + ivaCredito).toFixed(2)}</span>
        </div>

        <div className="pl-4 space-y-1">
          <div className="flex justify-between">
            <span>Compras locales</span>
            <span>${compras.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Otros tributos (ICE)</span>
            <span>${ice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>IVA crédito tributario</span>
            <span>${ivaCredito.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex justify-between font-bold border-t mt-2 pt-1">
          <span>Utilidad Bruta</span>
          <span>${utilidadBruta.toFixed(2)}</span>
        </div>

        <div className="flex justify-between mt-2">
          <span>Gastos operacionales</span>
          <span>$0.00</span>
        </div>

        <div className="flex justify-between font-bold border-t mt-2 pt-1 text-green-600">
          <span>Utilidad Neta del Ejercicio</span>
          <span>${utilidadNeta.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={exportToPDF}
          className="px-6 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700"
        >
          📄 Exportar PDF
        </button>
      </div>
    </div>
  );
}