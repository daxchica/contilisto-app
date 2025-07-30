// src/components/AccountsReceivablePayable.tsx

import React from "react";
import { JournalEntry } from "../types/JournalEntry";

interface Props {
  entries: JournalEntry[];
}

export default function AccountsReceivablePayable({ entries }: Props) {
  const cuentasPorCobrar = entries.filter(
    e => e.account_code?.startsWith("111") && (e.debit || 0) > 0
  );

  const cuentasPorPagar = entries.filter(
    e => e.account_code?.startsWith("211") && (e.credit || 0) > 0
  );

  const agruparPorFactura = (lista: JournalEntry[]) => {
    const map = new Map<string, { fecha: string, monto: number }>();

    lista.forEach(entry => {
      const key = entry.invoice_number || "SIN FACTURA";
      const fecha = entry.date || "SIN FECHA";
      const monto = (entry.debit || 0) - (entry.credit || 0);

      if (!map.has(key)) {
        map.set(key, { fecha, monto });
      } else {
        const actual = map.get(key)!;
        map.set(key, {
          fecha,
          monto: actual.monto + monto
        });
      }
    });

    return Array.from(map.entries()).map(([factura, data]) => ({
      factura,
      fecha: data.fecha,
      monto: data.monto
    })).filter(f => f.monto !== 0); // solo pendientes
  };

  const cuentasCobrar = agruparPorFactura(cuentasPorCobrar);
  const cuentasPagar = agruparPorFactura(cuentasPorPagar);

  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Cuentas por Cobrar */}
      <div>
        <h3 className="text-lg font-semibold text-blue-700 mb-2">📩 Cuentas por Cobrar</h3>
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Fecha</th>
              <th className="p-2 text-left">Factura</th>
              <th className="p-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {cuentasCobrar.map((cobro, idx) => (
              <tr key={idx} className="border-t">
                <td className="p-2">{cobro.fecha}</td>
                <td className="p-2">{cobro.factura}</td>
                <td className="p-2 text-right">${cobro.monto.toFixed(2)}</td>
              </tr>
            ))}
            {cuentasCobrar.length === 0 && (
              <tr>
                <td colSpan={3} className="p-2 text-center text-gray-500 italic">Sin cuentas por cobrar</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cuentas por Pagar */}
      <div>
        <h3 className="text-lg font-semibold text-red-700 mb-2">📤 Cuentas por Pagar</h3>
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Fecha</th>
              <th className="p-2 text-left">Factura</th>
              <th className="p-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {cuentasPagar.map((pago, idx) => (
              <tr key={idx} className="border-t">
                <td className="p-2">{pago.fecha}</td>
                <td className="p-2">{pago.factura}</td>
                <td className="p-2 text-right">${pago.monto.toFixed(2)}</td>
              </tr>
            ))}
            {cuentasPagar.length === 0 && (
              <tr>
                <td colSpan={3} className="p-2 text-center text-gray-500 italic">Sin cuentas por pagar</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}