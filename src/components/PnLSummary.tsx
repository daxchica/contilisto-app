// src/components/PnLSummary.tsx

import React, { useEffect, useMemo } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { JournalEntry } from "../types/JournalEntry";
import { PUCExpenseStructure } from "../utils/accountPUCMap";

interface Props {
  entries: JournalEntry[];
  startDate?: string;
  endDate?: string;
  onResultChange?: (result: number) => void;
}

const EXPENSE_CODES = Object.values(PUCExpenseStructure)
  .map(({ code }) => code)
  .filter((code): code is string => Boolean(code));

const NON_PREFIX_EXPENSE_CODES = EXPENSE_CODES.filter(
  (code) => !code.startsWith("5")
);

export default function PnLSummary({ 
  entries,
  startDate,
  endDate, 
  onResultChange 
}: Props) {
  // ---------------------------------------------------------
  // DATE FILTERING (solo PnL, no hay balance inicial aquí)
  // ---------------------------------------------------------
  const filteredEntries = useMemo(() => {
    if (!startDate && !endDate) return entries;

    const from = startDate ? new Date(startDate) : null;
    const to = endDate ? new Date(endDate) : null;

    return entries.filter((e) => {
      if (!e.date) return false;
      const d = new Date(e.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [entries, startDate, endDate]);

  const isIncomeOrExpenseAccount = (accountCode?: string) => {
    if (!accountCode) return false;
    const first = accountCode.charAt(0);
    return ["4", "5", "6", "7"].includes(first);
  };

  const sumByCode = (codes: string[], side: "debit" | "credit") =>
    filteredEntries
      .filter((e) => codes.includes(e.account_code || ""))
      .reduce((acc, e) => acc + Number(e[side] || 0), 0);

  const sumByPrefix = (prefix: string, side: "debit" | "credit") =>
    filteredEntries
      .filter(
        (e) => 
          (e.account_code || "").startsWith(prefix) &&
          isIncomeOrExpenseAccount(e.account_code)
        )
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

  // 🔍 Extract individual expense lines
  const detailedExpenses = useMemo(() => {
    const expenses = filteredEntries.filter(
      (e) =>
        e.account_code &&
        ["5", "6", "7"].includes(e.account_code.charAt(0)) &&
        (Number(e.debit) || 0) > 0
    );

    // Group by account code and sum
    const grouped = expenses.reduce((acc, e) => {
      const code = e.account_code!;
      const name = e.account_name || code;
      if (!acc[code]) acc[code] = { code, name, total: 0 };
      acc[code].total += Number(e.debit || 0);
      return acc;
    }, {} as Record<string, { code: string; name: string; total: number }>);

    return Object.values(grouped).sort((a, b) => a.code.localeCompare(b.code));
  }, [entries]);

  const summary = useMemo(() => {
    const ventas = sumByCode(["70101"], "credit");
    const compras = sumByCode(["60601"], "debit");
    const ice = sumByCode(["53901"], "debit");

    const costoVentas = compras + ice;

    const gastos = detailedExpenses.reduce((s, e) => s + e.total, 0);

    const utilidadBruta = ventas - costoVentas;
    const utilidadNeta = utilidadBruta - gastos;

    return {
      ventas,
      compras,
      ice,
      costoVentas,
      gastos,
      utilidadBruta,
      utilidadNeta,
    };
  }, [filteredEntries, detailedExpenses]);

  // 👉 Send net result to BalanceSheet
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

    const line = (
      label: string, 
      value?: number, 
      code?: string, 
      bold?: boolean,
      indent = 0
    ) => {
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
    line("Total Costos de Ventas", summary.costoVentas, undefined, true);

    y += 2;
    line("= Utilidad Bruta", summary.utilidadBruta, undefined, true);

    y += 2;
    line("(-) Gastos Operacionales", undefined, undefined, true);
    for (const g of detailedExpenses) {
      line(g.name, g.total, g.code, false, 10);
    }
    line("Total Gastos Operacionales", summary.gastos, undefined, true);

    y += 2; 
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
         {/* IVA credito tributario is not an expense (asset account 1-2 group), excluded from PnL */}
        </div>

        <div className="flex justify-between font-bold border-t mt-2 pt-1">
          <span>Utilidad Bruta</span>
          <span>{fmt(summary.utilidadBruta)}</span>
        </div>

        <div className="flex justify-between mt-2">
          <span>Gastos operacionales</span>
          <span>{fmt(summary.gastos)}</span>
        </div>

        <div className="pl-4 space-y-1">
          {detailedExpenses.map((exp) => (
            <div className="flex justify-between" key={exp.code}>
              <span>
                <span className="text-gray-500 mr-2">{exp.code}</span>
                {exp.name}
              </span>
              <span>{fmt(exp.total)}</span>
            </div>
          ))}
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