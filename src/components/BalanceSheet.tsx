// src/components/BalanceSheet.tsx

import React, { useMemo, useState } from "react";
import type { JournalEntry } from "../types/JournalEntry";
import { agruparCuentasPorTipo, formatearMonto } from "../utils/contabilidadUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";

interface Props {
  entries: JournalEntry[];
  result?: number;
}

export default function BalanceSheet({ entries, result = 0 }: Props) {
  const [nivel, setNivel] = useState(4);

  const cuentasPorTipo = useMemo(() => agruparCuentasPorTipo(entries), [entries]);

  const longitudesPermitidas = { 1: 1, 2: 2, 3: 3, 4: 5 };
  const maxLength = longitudesPermitidas[nivel] ?? 5;

  const construirFilas = () => {
    const rows: any[] = [];

    ["activo", "pasivo", "patrimonio"].forEach((tipo) => {
      let cuentas = cuentasPorTipo[tipo as keyof typeof cuentasPorTipo] || [];
      cuentas = cuentas.filter((cuenta) => cuenta.codigo.length <= maxLength);

      if (tipo === "patrimonio") {
        cuentas.push({
          codigo: "39999",
          nombre: "Resultado del Ejercicio",
          debito: 0,
          credito: 0,
          saldo: result,
        });
      }

      const total = cuentas.reduce((sum, c) => sum + c.saldo, 0);

      rows.push([
        tipo.toUpperCase(),
        "",
        "",
        "",
        "",
        ""
      ]);

      cuentas.forEach((cuenta) => {
        rows.push([
          cuenta.codigo,
          cuenta.nombre,
          "-",
          formatearMonto(cuenta.debito),
          formatearMonto(cuenta.credito),
          formatearMonto(cuenta.saldo),
        ]);
      });

      rows.push([
        `TOTAL ${tipo.toUpperCase()}`,
        "",
        "",
        "",
        "",
        formatearMonto(total),
      ]);
    });

    return rows;
  };

  const exportarPDF = () => {
    const doc = new jsPDF();
    doc.text("Balance General", 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [["Código", "Cuenta", "Balance Inicial", "Débito", "Crédito", "Saldo"]],
      body: construirFilas(),
    });
    doc.save("balance-general.pdf");
  };

  const exportarCSV = () => {
    const csv = Papa.unparse({
      fields: ["Código", "Cuenta", "Balance Inicial", "Débito", "Crédito", "Saldo"],
      data: construirFilas(),
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "balance-general.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSeccion = (tipo: "activo" | "pasivo" | "patrimonio") => {
    let cuentas = cuentasPorTipo[tipo] || [];
    cuentas = cuentas.filter((cuenta) => cuenta.codigo.length <= maxLength);

    if (tipo === "patrimonio") {
      cuentas.push({
        codigo: "39999",
        nombre: "Resultado del Ejercicio",
        debito: 0,
        credito: 0,
        saldo: result,
      });
    }

    const total = cuentas.reduce((sum, c) => sum + c.saldo, 0);

    return (
      <>
        <tr className="bg-gray-100">
          <td colSpan={6} className={`text-left font-bold py-2 px-4 ${
            tipo === "activo" 
              ? "text-green-700" 
              : tipo === "pasivo" 
              ? "text-red-700" 
              : "text-purple-700"
          }`}>
            {tipo.toUpperCase()}
          </td>
        </tr>

        {cuentas.map((cuenta) => (
          <tr key={cuenta.codigo} className="border-t">
            <td className="px-4 py-2 font-bold">{cuenta.codigo}</td>
            <td className="px-4 py-2">{cuenta.nombre}</td>
            <td className="px-4 py-2 text-right">-</td>
            <td className="px-4 py-2 text-right">{formatearMonto(cuenta.debito)}</td>
            <td className="px-4 py-2 text-right">{formatearMonto(cuenta.credito)}</td>
            <td className="px-4 py-2 text-right">{formatearMonto(cuenta.saldo)}</td>
          </tr>
        ))}

        <tr className="bg-gray-200 font-semibold">
          <td colSpan={5} className="px-4 py-2 text-right">
            Total {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
          </td>
          <td className="px-4 py-2 text-right">{formatearMonto(total)}</td>
        </tr>
      </>
    );
  };

  return (
    <div className="p-4">
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <h1 className="text-xl font-bold text-blue-800">📘 Balance General</h1>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="nivel" className="text-sm text-gray-700">Nivel:</label>
            <select
              id="nivel"
              className="border rounded px-2 py-1 text-sm"
              value={nivel}
              onChange={(e) => setNivel(Number(e.target.value))}
            >
              <option value={1}>Nivel 1</option>
              <option value={2}>Nivel 2</option>
              <option value={3}>Nivel 3</option>
              <option value={4}>Nivel 4</option>
            </select>
          </div>

          <button
            onClick={exportarPDF}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1 rounded"
          >
            📄 Exportar PDF
          </button>

          <button
            onClick={exportarCSV}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-1 rounded"
          >
            📊 Exportar CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Código</th>
              <th className="px-4 py-2 text-left">Cuenta</th>
              <th className="px-4 py-2 text-right">Balance Inicial</th>
              <th className="px-4 py-2 text-right">Débito</th>
              <th className="px-4 py-2 text-right">Crédito</th>
              <th className="px-4 py-2 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {renderSeccion("activo")}
            {renderSeccion("pasivo")}
            {renderSeccion("patrimonio")}
          </tbody>
        </table>
      </div>
    </div>
  );
}