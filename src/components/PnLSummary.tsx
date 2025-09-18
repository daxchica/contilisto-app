// src/components/PnLSummary.tsx
import React, { useMemo } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { JournalEntry } from "../types/JournalEntry";

interface Props { entries: JournalEntry[]; }

export default function PnLSummary({ entries }: Props) {
  // Totales por código (puedes ajustar el mapeo a tus cuentas reales)
  const sumByCode = (codes: string, side: "debit" | "credit") =>
    entries
      .filter((e) => codes.includes(e.account_code || ""))
      .reduce((acc, e) => acc + Number(e[side] || 0), 0);

  const sumByPrefix = (prefix: string, side: "debit" | "credit") =>
    entries
      .filter((e) => (e.account_code || "").startsWith(prefix))
      .reduce((acc, e) => acc + Number(e[side] || 0), 0);

    const ventas       = sumByCode(["70101"], "credit");
    const compras      = sumByCode(["60601"], "debit");
    const ice          = sumByCode(["53901"], "debit");
    const ivaCredito   = sumByCode(["24301"], "debit");

    const costoVentas  = compras + ice + ivaCredito;
    const utilidadBruta = ventas - costoVentas;
    const gastos = sumByPrefix("5", "debit");  // TODO: integrar mapeo de gastos cuando lo definas
    const utilidadNeta = utilidadBruta - gastos;

    const fmt = (n: number) =>
    new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: "USD",
    }).format(n);

    const exportToPDF = () => {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(16);
    doc.text("📊 Estado de Pérdidas y Ganancias", 14, y);
    y += 10;

    const line = (
      label: string,
      value: number,
      code?: string,
      bold?: boolean
    ) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const left = code ? `${code}  ${label}` : label;
      doc.text(
        `${left} ....................................... ${fmt(value)}`,
        14,
        y
      );
      y += 8;
    };

    line("Ingresos operacionales", 0, undefined, true);
    line("Ventas locales", ventas, "70101");

    y += 2;
    line("(-) Costo de Ventas", 0, undefined, true);
    line("Compras locales", compras, "60601");
    line("Otros tributos (ICE)", ice, "53901");
    line("IVA crédito tributario", ivaCredito, "24301");
    line("Total Costo de Ventas", costoVentas, undefined, true);

    y += 2;
    line("= Utilidad Bruta", utilidadBruta, undefined, true);
    line("(-) Gastos Operacionales", gastos, undefined, true);
    line("= Utilidad Neta del Ejercicio", utilidadNeta, undefined, true);

    doc.save("Estado_Perdidas_Ganancias.pdf");
  };

  // Estructura visible
  return (
    <div className="bg-white p-4 shadow rounded border">
      <h2 className="text-xl font-bold text-blue-800 mb-4">📈 Estado de Pérdidas y Ganancias</h2>

      <div className="space-y-1 font-mono text-sm">
        <div className="flex justify-between">
          <span><span className="text-gray-500 mr-2">70101</span>Ventas locales</span>
          <span>{fmt(ventas)}</span>
        </div>

        <div className="flex justify-between font-semibold mt-2">
          <span>Costos de Ventas:</span>
          <span>-{fmt(costoVentas)}</span>
        </div>

        <div className="pl-4 space-y-1">
          <div className="flex justify-between">
            <span><span className="text-gray-500 mr-2">60601</span>Compras locales</span>
            <span>{fmt(compras)}</span>
          </div>
          <div className="flex justify-between">
            <span><span className="text-gray-500 mr-2">53901</span>Otros tributos (ICE)</span>
            <span>{fmt(ice)}</span>
          </div>
          <div className="flex justify-between">
            <span><span className="text-gray-500 mr-2">24301</span>IVA crédito tributario</span>
            <span>{fmt(ivaCredito)}</span>
          </div>
        </div>

        <div className="flex justify-between font-bold border-t mt-2 pt-1">
          <span>Utilidad Bruta</span>
          <span>{fmt(utilidadBruta)}</span>
        </div>

        <div className="flex justify-between mt-2">
          <span>Gastos operacionales</span>
          <span>{fmt(gastos)}</span>
        </div>

        <div className="flex justify-between font-bold border-t mt-2 pt-1 text-green-600">
          <span>Utilidad Neta del Ejercicio</span>
          <span>{fmt(utilidadNeta)}</span>
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