import React from "react";
import { JournalEntry } from "@/types/JournalEntry";

interface Props {
  entries: JournalEntry[];
  result: number;
}

export default function BalanceSheetDisplay({ entries, result }: Props) {
  const filtrarPorGrupo = (grupo: string) =>
    entries.filter((e) =>
      typeof e.account_code === "string" &&
      e.account_code.startsWith(grupo) &&
      e.account_code.length <= 5 &&
      /^\d{1,5}$/.test(e.account_code)
    );

  const activos = filtrarPorGrupo("1");
  const pasivos = filtrarPorGrupo("2");
  const patrimonios = filtrarPorGrupo("3");

  console.log("Activos filtrados:", activos.map(e => e.account_code));
  console.log("Pasivos filtrados:", pasivos.map(e => e.account_code));
  console.log("Patrimonios filtrados:", patrimonios.map(e => e.account_code));

  const sumar = (list: JournalEntry[]) =>
    list.reduce(
      (acc, e) => ({
        debito: acc.debito + (e.debit || 0),
        credito: acc.credito + (e.credit || 0),
        saldo: acc.saldo + ((e.debit || 0) - (e.credit || 0)),
      }),
      { debito: 0, credito: 0, saldo: 0 }
    );

  const totalActivos = sumar(activos);
  const totalPasivos = sumar(pasivos);
  const totalPatrimonios = sumar(patrimonios);
  const totalPatrimonioFinal = totalPatrimonios.saldo + result;

  const format = (n: number) =>
    n.toLocaleString("es-EC", { style: "currency", currency: "USD" });

  const renderGrupo = (titulo: string, cuentas: JournalEntry[]) => (
    <>
      <tr className="bg-gray-100 text-left font-bold">
        <td colSpan={6} className={
          titulo === "ACTIVO"
            ? "text-green-700 px-4 py-2"
            : titulo === "PASIVO"
            ? "text-red-700 px-4 py-2"
            : "text-purple-700 px-4 py-2"
        }>
          {titulo}
        </td>
      </tr>
      {cuentas.map((e) => (
        <tr key={e.account_code} className="border-t text-sm">
          <td className="px-4 py-1 font-bold">{e.account_code}</td>
          <td className="px-4 py-1">{e.account_name}</td>
          <td className="px-4 py-1 text-right">$0,00</td>
          <td className="px-4 py-1 text-right">{format(e.debit || 0)}</td>
          <td className="px-4 py-1 text-right">{format(e.credit || 0)}</td>
          <td className="px-4 py-1 text-right">{format((e.debit || 0) - (e.credit || 0))}</td>
        </tr>
      ))}
    </>
  );

  return (
    <div className="p-4 bg-white rounded shadow mt-4">
      <h2 className="text-lg font-bold mb-3">📘 Balance General</h2>

      <table className="min-w-full border border-gray-300 text-sm">
        <thead className="bg-gray-200">
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
          {renderGrupo("ACTIVO", activos)}
          
          <tr className="bg-gray-100 font-semibold">
            <td colSpan={5} className="px-4 py-2 text-right">Total Activo</td>
            <td className="px-4 py-2 text-right">{format(totalActivos.saldo)}</td>
          </tr>

          {renderGrupo("PASIVO", pasivos)}
          <tr className="bg-gray-100 font-semibold">
            <td colSpan={5} className="px-4 py-2 text-right">Total Pasivo</td>
            <td className="px-4 py-2 text-right">{format(totalPasivos.saldo)}</td>
          </tr>

          {renderGrupo("PATRIMONIO", patrimonios)}
          <tr className="border-t text-sm text-green-700">
            <td className="px-4 py-1 font-bold">Resultado</td>
            <td className="px-4 py-1">Resultado del Ejercicio</td>
            <td className="px-4 py-1 text-right">$0,00</td>
            <td className="px-4 py-1 text-right">—</td>
            <td className="px-4 py-1 text-right">—</td>
            <td className="px-4 py-1 text-right">{format(result)}</td>
          </tr>
          <tr className="bg-gray-100 font-semibold">
            <td colSpan={5} className="px-4 py-2 text-right">Total Patrimonio</td>
            <td className="px-4 py-2 text-right">{format(totalPatrimonioFinal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}