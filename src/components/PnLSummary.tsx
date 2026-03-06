// src/components/PnLSummary.tsx

import React, { useMemo, useEffect } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { JournalEntry } from "../types/JournalEntry";

interface Props {
  entries: JournalEntry[];
  startDate?: string;
  endDate?: string;
  onResultChange?: (result: number) => void;
}

export default function PnLSummary({
  entries,
  startDate,
  endDate,
  onResultChange,
}: Props) {

  /* ----------------------------------------------------- */
  /* DATE FILTER                                           */
  /* ----------------------------------------------------- */

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

  /* ----------------------------------------------------- */
  /* FINANCIAL ENGINE                                      */
  /* ----------------------------------------------------- */

  const summary = useMemo(() => {

    const ingresos = filteredEntries
      .filter((e) => (e.account_code || "").startsWith("4"))
      .reduce(
        (sum, e) => sum + Number(e.credit || 0) - Number(e.debit || 0),
        0
      );

    const costos = filteredEntries
      .filter((e) => (e.account_code || "").startsWith("6"))
      .reduce(
        (sum, e) => sum + Number(e.debit || 0) - Number(e.credit || 0),
        0
      );

    const gastos = filteredEntries
      .filter((e) => (e.account_code || "").startsWith("5"))
      .reduce(
        (sum, e) => sum + Number(e.debit || 0) - Number(e.credit || 0),
        0
      );

    const utilidadBruta = ingresos - costos;
    const utilidadNeta = utilidadBruta - gastos;

    return {
      ingresos,
      costos,
      gastos,
      utilidadBruta,
      utilidadNeta,
    };

  }, [filteredEntries]);

  /* ----------------------------------------------------- */
  /* EXPENSE DETAILS                                       */
  /* ----------------------------------------------------- */

  const detailedExpenses = useMemo(() => {

    const expenses = filteredEntries.filter(
      (e) =>
        e.account_code &&
        e.account_code.startsWith("5") &&
        Number(e.debit || 0) > 0
    );

    const grouped = expenses.reduce((acc, e) => {

      const code = e.account_code!;
      const name = e.account_name || code;

      if (!acc[code]) {
        acc[code] = { code, name, total: 0 };
      }

      acc[code].total += Number(e.debit || 0);

      return acc;

    }, {} as Record<string, { code: string; name: string; total: number }>);

    return Object.values(grouped).sort((a, b) =>
      a.code.localeCompare(b.code)
    );

  }, [filteredEntries]);

  /* ----------------------------------------------------- */
  /* SEND RESULT TO BALANCE SHEET                          */
  /* ----------------------------------------------------- */

  useEffect(() => {

    if (onResultChange) {
      onResultChange(summary.utilidadNeta || 0);
    }

  }, [summary.utilidadNeta, onResultChange]);

  /* ----------------------------------------------------- */
  /* FORMATTER                                             */
  /* ----------------------------------------------------- */

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }),
    []
  );

  const fmt = (n: number) => formatter.format(n || 0);

  /* ----------------------------------------------------- */
  /* PDF EXPORT                                            */
  /* ----------------------------------------------------- */

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
      bold?: boolean
    ) => {

      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(bold ? 12 : 10);

      const text = code ? `${code} ${label}` : label;

      doc.text(text, 20, y);

      if (value !== undefined) {
        doc.text(fmt(value), 180, y, { align: "right" });
      }

      y += 7;
    };

    line("Ingresos Operacionales", undefined, undefined, true);
    line("Ingresos", summary.ingresos);

    y += 2;

    line("(-) Costos de Ventas", summary.costos, undefined, true);

    y += 2;

    line("= Utilidad Bruta", summary.utilidadBruta, undefined, true);

    y += 4;

    line("(-) Gastos Operacionales", undefined, undefined, true);

    detailedExpenses.forEach((exp) => {
      line(exp.name, exp.total, exp.code);
    });

    line("Total Gastos", summary.gastos, undefined, true);

    y += 4;

    line("Resultado del Ejercicio", summary.utilidadNeta, undefined, true);

    doc.save("Estado_Perdidas_Ganancias.pdf");

  };

  /* ----------------------------------------------------- */
  /* UI                                                    */
  /* ----------------------------------------------------- */

  return (
    <div className="bg-white p-4 shadow rounded border">

      <h2 className="text-xl font-bold text-blue-800 mb-4">
        📈 Estado de Pérdidas y Ganancias
      </h2>

      <div className="space-y-1 font-mono text-sm">

        <div className="flex justify-between">
          <span>Ingresos</span>
          <span>{fmt(summary.ingresos)}</span>
        </div>

        <div className="flex justify-between font-semibold mt-2">
          <span>Costos de Ventas</span>
          <span>-{fmt(summary.costos)}</span>
        </div>

        <div className="flex justify-between font-bold border-t mt-2 pt-1">
          <span>Utilidad Bruta</span>
          <span>{fmt(summary.utilidadBruta)}</span>
        </div>

        <div className="flex justify-between mt-2">
          <span>Gastos Operacionales</span>
          <span>{fmt(summary.gastos)}</span>
        </div>

        <div className="pl-4 space-y-1">
          {detailedExpenses.map((exp) => (
            <div key={exp.code} className="flex justify-between">
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