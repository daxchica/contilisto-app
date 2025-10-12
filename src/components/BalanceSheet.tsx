import React from "react";
import type { JournalEntry } from "../types/JournalEntry";
import { agruparCuentasPorTipo, formatearMonto } from "../utils/contabilidadUtils";

interface Props {
  entries: JournalEntry[];
  result?: number;
}

export default function BalanceSheet({ entries, result = 0 }: Props) {
  const cuentasPorTipo = agruparCuentasPorTipo(entries);

  const renderSeccion = (tipo: "activo" | "pasivo" | "patrimonio") => {
    let cuentas = cuentasPorTipo[tipo] || [];
    cuentas = cuentas.filter((cuenta) => cuenta.codigo.length <= 5);

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
            <td className="px-4 py-2 text-right">{/* Saldo inicial no disponible */}-</td>
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
      <h1 className="text-xl font-bold mb-4">📘 Balance General</h1>
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