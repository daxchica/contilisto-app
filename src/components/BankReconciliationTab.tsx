// src/components/BankReconciliationTab.tsx
import React, { useState, useMemo } from "react";
import { JournalEntry } from "../types/JournalEntry";
import { BankMovement } from "../types/bankTypes";

interface Props {
  journalEntries: JournalEntry[];
  bankMovements: BankMovement[];
  selectedBankName?: string;
}

export default function BankReconciliationTab({ 
  journalEntries, 
  bankMovements, 
  selectedBankName, 
}: Props) {
  const [reconciled, setReconciled] = useState<string[]>([]);

  const toggleReconcile = (id: string) => {
    setReconciled((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const formatAmount = (value?: number) =>
    value !== undefined
      ? new Intl.NumberFormat("es-EC", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        }).format(value)
      : "-";

  const reconciledTotal = useMemo(() => {
    return bankMovements.reduce((acc, m) => {
      const id = m.id;

      if (!id) return acc;

      if (reconciled.includes(id)) {
        return acc + (m.amount ?? 0);
      }

      return acc;
    } , 0);
  }, [reconciled, bankMovements]
  );

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2">

      {/* ── Libro Diario ── */}
      <div className="min-w-0">
        <h2 className="text-base font-bold text-blue-700 mb-2">
          📒 Libro Diario
        </h2>

        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left whitespace-nowrap">Fecha</th>
                <th className="px-2 py-2 text-left whitespace-nowrap">Código</th>
                <th className="px-2 py-2 text-left">Cuenta</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">Débito</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">Crédito</th>
              </tr>
            </thead>

            <tbody>
              {journalEntries.map((entry, i) => (
                <tr key={i} className="border-t even:bg-gray-50">
                  <td className="px-2 py-1.5 whitespace-nowrap">{entry.date}</td>
                  <td className="px-2 py-1.5 font-mono whitespace-nowrap">{entry.account_code}</td>
                  <td className="px-2 py-1.5 max-w-[120px] truncate" title={entry.account_name}>
                    {entry.account_name}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                    {entry.debit ? formatAmount(entry.debit) : ""}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                    {entry.credit ? formatAmount(entry.credit) : ""}
                  </td>
                </tr>
              ))}
              {journalEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-400 text-xs">
                    Sin registros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Banco ── */}
      <div className="min-w-0">
        <h2 className="text-base font-bold text-green-700 mb-2">
          🏦 Banco {selectedBankName ?? "-"}
        </h2>

        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left whitespace-nowrap">Fecha</th>
                <th className="px-2 py-2 text-left">Descripción</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">Monto</th>
                <th className="px-2 py-2 text-center whitespace-nowrap">Conciliar</th>
              </tr>
            </thead>

            <tbody>
              {bankMovements.map((mvt) => {
                if (!mvt.id) return null;
                const isReconciled = reconciled.includes(mvt.id);

                return (
                  <tr
                    key={mvt.id}
                    className={`border-t ${isReconciled ? "bg-green-50" : "hover:bg-gray-50"}`}
                  >
                    <td className="px-2 py-1.5 whitespace-nowrap">{mvt.date}</td>
                    <td className="px-2 py-1.5 max-w-[140px] truncate" title={mvt.description}>
                      {mvt.description}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                      {formatAmount(mvt.amount)}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => toggleReconcile(mvt.id ?? "")}
                        className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                          isReconciled
                            ? "bg-green-600 text-white"
                            : "bg-gray-200 hover:bg-gray-300"
                        }`}
                      >
                        {isReconciled ? "✓ Ok" : "Conciliar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {bankMovements.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-400 text-xs">
                    Sin movimientos
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot>
              <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                <td colSpan={2} className="px-2 py-2 text-xs">Total conciliado:</td>
                <td className="px-2 py-2 text-right text-xs tabular-nums">
                  {formatAmount(reconciledTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  );
}