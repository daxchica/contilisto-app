// src/components/PnLSummary.tsx

import React, { useEffect, useMemo } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { JournalEntry } from "../types/JournalEntry";
import { PUCExpenseStructure } from "../utils/accountPUCMap";

interface Props {
  entries: JournalEntry[];
  onResultChange?: (result: number) => void;
}

const EXPENSE_CODES = Object.values(PUCExpenseStructure)
  .map(({ code }) => code)
  .filter((code): code is string => Boolean(code));

const NON_PREFIX_EXPENSE_CODES = EXPENSE_CODES.filter(
  (code) => !code.startsWith("5")
);

export default function PnLSummary({ entries, onResultChange }: Props) {
  const sumByCode = (codes: string[], side: "debit" | "credit") =>
    entries
      .filter((e) => codes.includes(e.account_code || ""))
      .reduce((acc, e) => acc + Number(e[side] || 0), 0);

  const sumByPrefix = (prefix: string, side: "debit" | "credit") =>
    entries
      .filter((e) => (e.account_code || "").startsWith(prefix))
      .reduce((acc, e) => acc + Number(e[side] || 0), 0);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }),
    []
  );

  const summary = useMemo(() => {
    const ventas = sumByCode(["70101"], "credit");
    const compras = sumByCode(["60601"], "debit");
    const ice = sumByCode(["53901"], "debit");
    const ivaCredito = sumByCode(["24301"], "debit");

    const costoVentas = compras + ice + ivaCredito;
    const gastos =
      sumByPrefix("5", "debit") + sumByCode(NON_PREFIX_EXPENSE_CODES, "debit");

    const utilidadBruta = ventas - costoVentas;
    const utilidadNeta = utilidadBruta - gastos;

    return {
      ventas,
      compras,
      ice,
      ivaCredito,
      costoVentas,
      gastos,
      utilidadBruta,
      utilidadNeta,
    };
  }, [entries]);

  // 👉 Enviar resultado al componente padre (BalanceSheet)
  useEffect(() => {
    if (onResultChange) onResultChange(summary.utilidadNeta || 0);
  }, [summary.utilidadNeta, onResultChange]);

  const fmt = (n: number) => {
    if (Math.abs(n) < 0.005) return "$0,00";
    return formatter.format(n);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.text("Estado de Pérdidas y Ganancias", 20, y);
    y += 10;

    const line = (label: string, value?: number, code?: string, bold?: boolean) => {
      doc.setFontSize(bold ? 12 : 10);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const text = code ? `${code} ${label}` : label;
      doc.text(text, 20, y);
      if (value !== undefined) {
        doc.text(fmt(value), 160, y, { align: "right" });
      }
      y += 7;
    };

    line("Ingresos operacionales", undefined, undefined, true);
    line("Ventas locales", summary.ventas, "70101");

    y += 2;
    line("(-) Costos de Ventas", undefined, undefined, true);
    line("Compras locales", summary.compras, "60601");
    line("Otros tributos (ICE)", summary.ice, "53901");
    line("IVA crédito tributario", summary.ivaCredito, "24301");
    line("Total Costos de Ventas", summary.costoVentas, undefined, true);

    y += 2;
    line("= Utilidad Bruta", summary.utilidadBruta, undefined, true);
    line("(-) Gastos Operacionales", summary.gastos, undefined, true);
    line("= Resultado del Ejercicio", summary.utilidadNeta, undefined, true);

    doc.save("Estado_Perdidas_Ganancias.pdf");
  };

  return (
    <div className="bg-white p-4 shadow rounded border">
      <h2 className="text-xl font-bold text-blue-800 mb-4">
        📈 Estado de Pérdidas y Ganancias
      </h2>

      <div className="space-y-1 font-mono text-sm">
        <div className="flex justify-between">
          <span>
            <span className="text-gray-500 mr-2">70101</span>Ventas locales</span>
          <span>{fmt(summary.ventas)}</span>
        </div>

        <div className="flex justify-between font-semibold mt-2">
          <span>Costos de Ventas:</span>
          <span>-{fmt(summary.costoVentas)}</span>
        </div>

        <div className="pl-4 space-y-1">
          <div className="flex justify-between">
            <span>
              <span className="text-gray-500 mr-2">60601</span>Compras locales
            </span>
            <span>{fmt(summary.compras)}</span>
          </div>
          <div className="flex justify-between">
            <span>
              <span className="text-gray-500 mr-2">53901</span>Otros tributos (ICE)
            </span>
            <span>{fmt(summary.ice)}</span>
          </div>
          <div className="flex justify-between">
            <span>
              <span className="text-gray-500 mr-2">24301</span>IVA crédito tributario</span>
            <span>{fmt(summary.ivaCredito)}</span>
          </div>
        </div>

        <div className="flex justify-between font-bold border-t mt-2 pt-1">
          <span>Utilidad Bruta</span>
          <span>{fmt(summary.utilidadBruta)}</span>
        </div>

        <div className="flex justify-between mt-2">
          <span>Gastos operacionales</span>
          <span>{fmt(summary.gastos)}</span>
        </div>

        <div className="flex justify-between font-bold border-t mt-2 pt-1 text-green-600">
          <span>Resultado del Ejercicio</span>
          <span>{fmt(summary.utilidadNeta)}</span>
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