import React, { useMemo } from "react";
import { JournalEntry } from "../types/JournalEntry";

interface Props {
  entries: JournalEntry[];
}

export default function BalanceSheet({ entries }: Props) {
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }),
    []
  );

  const fmt = (n: number) => formatter.format(n);

  const groupAndSumAccounts = (prefix: string, type: "debit" | "credit") => {
    const map = new Map<string, { code: string; name: string; value: number }>();
    entries
      .filter((e) => (e.account_code || "").startsWith(prefix))
      .forEach((e) => {
        const code = e.account_code || "";
        const name = e.account_name || "";
        const key = `${code} - ${name}`;
        const amount = type === "debit"
          ? (e.debit || 0) - (e.credit || 0)
          : (e.credit || 0) - (e.debit || 0);
        if (!map.has(key)) {
          map.set(key, { code, name, value: amount});
        } else {
          const prev = map.get(key)!;
          prev.value += amount;
        }
      });
      return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  };

  const getUtilidadDelEjercicio = () => {
    const ventas = entries
      .filter((e) => e.account_code === "70101")
      .reduce((acc, e) => acc + Number(e.credit || 0), 0);

    const compras = entries
      .filter((e) => e.account_code === "60601")
      .reduce((acc, e) => acc + Number(e.debit || 0), 0);

    const ice = entries
      .filter((e) => e.account_code === "53901")
      .reduce((acc, e) => acc + Number(e.debit || 0), 0);

    const ivaCredito = entries
      .filter((e) => e.account_code === "24301")
      .reduce((acc, e) => acc + Number(e.debit || 0), 0);

    const gastos = entries
      .filter((e) => (e.account_code || "").startsWith("5"))
      .reduce((acc, e) => acc + Number(e.debit || 0), 0);

    return ventas - compras - ice -ivaCredito - gastos;
  };

  const utilidadNeta = getUtilidadDelEjercicio();

  const activos = groupAndSumAccounts("1", "debit");
  const pasivos = groupAndSumAccounts("2", "credit");
  const patrimonio = groupAndSumAccounts("3", "credit");

  const totalActivo = activos.reduce((sum, c) => sum + c.value, 0);
  const totalPasivo = pasivos.reduce((sum, c) => sum + c.value, 0);
  const totalPatrimonio = patrimonio.reduce((sum, c) => sum + c.value, 0) + utilidadNeta;

  return (
    <div className="bg-white p-4 rounded shadow border">
      <h2 className="text-xl font-bold text-blue-800 mb-4">📊 Balance General</h2>

      <div className="grid grid-cols-2 gap-8 font-mono text-sm">
        <div>
          <h3 className="text-lg font-semibold text-green-700 mb-2">ACTIVO</h3>
          {activos.map((a, i) => (
            <div key={i} className="flex justify-between">
              <span>
                <span className="text-gray-500 mr-1">{a.code}</span>
                {a.name}
              </span>
              <span>{fmt(a.value)}</span>
            </div>
          ))}
        </div>

        {/* PASIVO + PATRIMONIO */}
        <div>
          <h3 className="text-lg font-semibold text-red-700 mb-2">PASIVO</h3>
          {pasivos.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>
                <span className="text-gray-500 mr-1">{p.code}</span>
                {p.name}
              </span>
              <span>{fmt(p.value)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold border-t mt-2 pt-1">
            <span>Total Pasivo</span>
            <span>{fmt(totalPasivo)}</span>
          </div>

          <h3 className="text-lg font-semibold text-purple-700 mt-4 mb-2">PATRIMONIO</h3>
          {patrimonio.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>
                <span className="text-gray-500 mr-1">{p.code}</span>
                {p.name}
              </span>
              <span>{fmt(p.value)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold mt-2 text-green-700">
            <span>Resultado del Ejercicio</span>
            <span>{fmt(utilidadNeta)}</span>
          </div>
          <div className="flex justify-between font-bold border-t pt-1">
            <span>Total Patrimonio</span>
            <span>{fmt(totalPatrimonio)}</span>
          </div>
        </div>
      </div>

        {/* Linea horizontal final */}
        <hr className="my-4 border-t border-gray-300 col-span-2" />

        <div className="grid grid-cols-2 font-bold text-lg">
        {/* Activo: Total en misma linea */}
        <div className="flex justify-between pr-6 text-green-900">
          <span>Total Activo</span>
          <span>{fmt(totalActivo)}</span>
        </div>
        
        {/* Total Pasivo + Patrimonio debajo del Total Patrimonio */}
        <div className="flex flex-col items-end">
          <span>Total Pasivo + Patrimonio</span>
          <span>{fmt(totalPasivo + totalPatrimonio)}</span>
        </div>
      </div>
    </div>
  );
}