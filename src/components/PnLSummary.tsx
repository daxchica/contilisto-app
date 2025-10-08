// src/components/PnLSummary.tsx
import React, { useMemo } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { JournalEntry } from "../types/JournalEntry";
import { PUCExpenseStructure } from "../utils/accountPUCMap";

interface Props { entries: JournalEntry[]; }

const EXPENSE_CODES = Object.values(PUCExpenseStructure)
  .map(({ code }) => code)
  .filter((code): code is string => Boolean(code));

const NON_PREFIX_EXPENSE_CODES = EXPENSE_CODES.filter((code) => !code.startsWith("5"));

export default function PnLSummary({ entries }: Props) {
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
      }),
    []
  );

  const summary = useMemo(() => {
    const nonPrefixExpenses = new Set(NON_PREFIX_EXPENSE_CODES);

    let ventas = 0;
    let compras = 0;
    let ice = 0;
    let ivaCredito = 0;
    let gastos = 0;
    let patrimonioDebitos = 0;
    let patrimonioCreditos = 0;

    entries.forEach((entry) => {
      const code = entry.account_code || "";
      if (!code) return;

      const debit = Number(entry.debit ?? 0);
      const credit = Number(entry.credit ?? 0);

      switch (code) {
        case "70101":
          ventas += credit;
          break;
        case "60601":
          compras += debit;
          break;
        case "53901":
          ice += debit;
          break;
        case "24301":
          ivaCredito += debit;
          break;
        default:
          break;
      }

      if (code.startsWith("5") || nonPrefixExpenses.has(code)) {
        gastos += debit;
      }

      if (code.startsWith("3")) {
        patrimonioDebitos += debit;
        patrimonioCreditos += credit;
      }
    });

    const costoVentas = compras + ice + ivaCredito;
    const utilidadBruta = ventas - costoVentas;
    const utilidadNeta = utilidadBruta - gastos;
    const patrimonioRegistrado = patrimonioCreditos - patrimonioDebitos;
    const patrimonioTotal = patrimonioRegistrado + utilidadNeta;

    return {
      ventas,
      compras,
      ice,
      ivaCredito,
      costoVentas,
      utilidadBruta,
      gastos,
      utilidadNeta,
      patrimonioRegistrado,
      patrimonioTotal,
    };
  }, [entries]);

  const fmt = (n: number) => formatter.format(n);

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
    line("Ventas locales", summary.ventas, "70101");

    y += 2;
    line("(-) Costo de Ventas", 0, undefined, true);
    line("Compras locales", summary.compras, "60601");
    line("Otros tributos (ICE)", summary.ice, "53901");
    line("IVA crédito tributario", summary.ivaCredito, "24301");
    line("Total Costo de Ventas", summary.costoVentas, undefined, true);

    y += 2;
    line("= Utilidad Bruta", summary.utilidadBruta, undefined, true);
    line("(-) Gastos Operacionales", summary.gastos, undefined, true);
    line("= Utilidad Neta del Ejercicio", summary.utilidadNeta, undefined, true);

    y += 4;
    line("Patrimonio de la entidad", 0, undefined, true);
    line("Saldo patrimonio (cód. 3)", summary.patrimonioRegistrado);
    line("Cuenta resultados del ejercicio", summary.utilidadNeta, undefined, true);
    line("Total patrimonio con resultado", summary.patrimonioTotal, undefined, true);

    doc.save("Estado_Perdidas_Ganancias.pdf");
  };

  // Estructura visible
  return (
    <div className="bg-white p-4 shadow rounded border">
      <h2 className="text-xl font-bold text-blue-800 mb-4">📈 Estado de Pérdidas y Ganancias</h2>

      <div className="space-y-1 font-mono text-sm">
        <div className="flex justify-between">
          <span><span className="text-gray-500 mr-2">70101</span>Ventas locales</span>
          <span>{fmt(summary.ventas)}</span>
        </div>

        <div className="flex justify-between font-semibold mt-2">
          <span>Costos de Ventas:</span>
          <span>-{fmt(summary.costoVentas)}</span>
        </div>

        <div className="pl-4 space-y-1">
          <div className="flex justify-between">
            <span><span className="text-gray-500 mr-2">60601</span>Compras locales</span>
            <span>{fmt(summary.compras)}</span>
          </div>
          <div className="flex justify-between">
            <span><span className="text-gray-500 mr-2">53901</span>Otros tributos (ICE)</span>
            <span>{fmt(summary.ice)}</span>
          </div>
          <div className="flex justify-between">
            <span><span className="text-gray-500 mr-2">24301</span>IVA crédito tributario</span>
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
          <span>Utilidad Neta del Ejercicio</span>
          <span>{fmt(summary.utilidadNeta)}</span>
        </div>

        <div className="border-t mt-4 pt-3 space-y-1 text-sm">
          <div className="flex justify-between font-semibold text-blue-800">
            <span>Patrimonio (cód. 3)</span>
            <span>{fmt(summary.patrimonioRegistrado)}</span>
          </div>
          <div className="flex justify-between text-blue-700">
            <span>Cuenta de resultados del ejercicio</span>
            <span>{fmt(summary.utilidadNeta)}</span>
          </div>
          <div className="flex justify-between font-bold border-t pt-1 text-blue-900">
            <span>Patrimonio total con resultado</span>
            <span>{fmt(summary.patrimonioTotal)}</span>
          </div>
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
