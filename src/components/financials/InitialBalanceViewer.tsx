// src/components/financials/InitialBalanceViewer.tsx

import React, { useMemo } from "react";
import type { JournalEntry } from "@/types/JournalEntry";

interface Props {
  entries: JournalEntry[];
}

export default function InitialBalanceViewer({ entries }: Props) {

  // ---------------------------------------------------
  // FILTER INITIAL ENTRIES
  // ---------------------------------------------------
  const initialEntries = useMemo(
    () => entries.filter(e => e.source === "initial"),
    [entries]
  );

  // ---------------------------------------------------
  // SORT (by account_code)
  // ---------------------------------------------------
  const sortedEntries = useMemo(() => {
    return [...initialEntries].sort((a, b) =>
      (a.account_code || "").localeCompare(b.account_code || "")
    );
  }, [initialEntries]);

  // ---------------------------------------------------
  // TOTALS (CRITICAL)
  // ---------------------------------------------------
  const totals = useMemo(() => {
    return sortedEntries.reduce(
      (acc, e) => {
        acc.debit += Number(e.debit || 0);
        acc.credit += Number(e.credit || 0);
        return acc;
      },
      { debit: 0, credit: 0 }
    );
  }, [sortedEntries]);

  // ---------------------------------------------------
  // EMPTY STATE
  // ---------------------------------------------------
  if (!sortedEntries.length) {
    return (
      <div className="text-sm text-gray-500">
        No hay balance inicial registrado.
      </div>
    );
  }

  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01;

  // ---------------------------------------------------
  // RENDER
  // ---------------------------------------------------
  return (
    <div className="border rounded-lg overflow-hidden">

      {/* TABLE */}
      <table className="w-full text-sm">
        <thead className="bg-gray-200 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-3 py-2 w-[140px]">Código</th>
            <th className="text-left px-3 py-2">Cuenta</th>
            <th className="text-right px-3 py-2 w-[140px]">Débito</th>
            <th className="text-right px-3 py-2 w-[140px]">Crédito</th>
          </tr>
        </thead>

        <tbody>
          {sortedEntries.map((e) => (
            <tr key={e.id || `${e.account_code}-${e.account_name}`} className="border-t">
              <td className="px-3 py-2 font-mono text-sm">{e.account_code}</td>
              <td className="px-3 py-2">{e.account_name}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                {Number(e.debit || 0).toFixed(2)}
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                {Number(e.credit || 0).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>

        {/* FOOTER TOTALS */}
        <tfoot className="bg-gray-50 font-semibold border-t">
          <tr>
            <td className="px-3 py-2" colSpan={2}>
              Totales
            </td>
            <td className="px-3 py-2 text-right">
              {totals.debit.toFixed(2)}
            </td>
            <td className="px-3 py-2 text-right">
              {totals.credit.toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* BALANCE STATUS */}
      <div
        className={`px-4 py-2 text-sm ${
          isBalanced
            ? "text-green-700 bg-green-50"
            : "text-red-700 bg-red-50"
        }`}
      >
        {isBalanced
          ? "✔ Balance cuadrado"
          : "⚠ El balance inicial NO está cuadrado"}
      </div>

    </div>
  );
}