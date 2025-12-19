// src/components/TrialBalance.tsx
import React, { useMemo } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { JournalEntry } from "../types/JournalEntry";
import { useInitialBalances } from "../hooks/useInitialBalances";

type Props = {
  entries: JournalEntry[];
  startDate?: string;
  endDate?: string;
};

const fmtUSD = (n: number) =>
  new Intl.NumberFormat("es-EC", { 
    style: "currency", 
    currency: "USD",
    minimumFractionDigits: 2,
   }).format(n || 0);

export default function TrialBalance({ entries, startDate, endDate }: Props) {
  const initialBalances = useInitialBalances();
  
  // ---------------------------------------------------------
  // DATE FILTERING
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

   // ---------------------------------------------------------
  // AGRUPAR POR CUENTA
  // - Balance inicial viene de initialBalances (no se filtra por fecha)
  // - Débito/Crédito de movimientos filtrados por rango
  // ---------------------------------------------------------
  const rows = useMemo(() => {
    const map = new Map<
      string,
      { 
        account_code: string; 
        account_name: string; 
        initial: number;
        debit: number; 
        credit: number; 
        balance: number 
      }
    >();

    // 1. Iniciar con balances iniciales
    for (const b of initialBalances) {
      const code = b.account_code.trim();
      const name = b.account_name.trim() || "(Sin nombre)";
      const key = `${code}||${name}`;
      if (!map.has(key)) {
        map.set(key, {
          account_code: code,
          account_name: name,
          initial: 0,
          debit: 0,
          credit: 0,
          balance: 0,
        });
      }
      const r = map.get(key)!;
      r.initial += Number(b.initial_balance || 0);
    }

    // 2. Sumar movimientos contables
    for (const e of entries) {
      const code = (e.account_code || "").trim();
      const name = (e.account_name || "").trim() || "(Sin nombre)";
      if (!code) continue;

      const key = `${code}||${name}`;

      if (!map.has(key)) {
        map.set(key, {
          account_code: code,
          account_name: name,
          initial: 0,
          debit: 0,
          credit: 0,
          balance: 0,
        });
      }
      const row = map.get(key)!;
      row.debit += Number(e.debit || 0);
      row.credit += Number(e.credit || 0);
    }

    // 3. Calcular saldos finales
    for (const r of map.values()) {
      r.balance = r.initial + r.debit - r.credit;
    }

    return Array.from(map.values()).sort((a, b) =>
      a.account_code.localeCompare(b.account_code, "es")
    );
  }, [filteredEntries, initialBalances]);

  // Totales
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          acc.initial += r.initial;
          acc.debit += r.debit;
          acc.credit += r.credit;
          acc.balance += r.balance;
          return acc;
        },
        { initial: 0, debit: 0, credit: 0, balance: 0 }
      ),
    [rows]
  );

  // Exportar PDF
  const exportToPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginX = 40;
    let y = 40;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("📘 Balance de Comprobación", marginX, y);
    y += 20;

    (doc as any).autoTable({
      startY: y,
      head: [
        [
          "Código", 
          "Cuenta", 
          "Balance Inicial", 
          "Débito", 
          "Crédito", 
          "Saldo"
        ]
      ],
      body: rows.map((r) => [
        r.account_code,
        r.account_name,
        fmtUSD(r.initial),
        fmtUSD(r.debit),
        fmtUSD(r.credit),
        fmtUSD(r.balance),
      ]),
      styles: { font: "helvetica", fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [30, 64, 175] },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
      theme: "striped",
      margin: { left: marginX, right: marginX },
      foot: [[
          { content: "Totales", colSpan: 2 },
          { content: fmtUSD(totals.initial), styles: { halign: "right" } },
          { content: fmtUSD(totals.debit), styles: { halign: "right" } },
          { content: fmtUSD(totals.credit), styles: { halign: "right" } },
          { content: fmtUSD(totals.balance), styles: { halign: "right" } },
        ],],
      footStyles: { fillColor: [226, 232, 240], textColor: [0, 0, 0] },
    });

    doc.save("Balance_de_Comprobacion.pdf");
  };

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------
  return (
    <div className="flex justify-center">
      <div className="w-full bg-white shadow rounded p-6">
        <h2 className="text-xl font-bold text-blue-800 mb-4 text-center">
          📘 Balance de Comprobación
        </h2>

        {rows.length === 0 ? (
          <p className="text-gray-600 text-center">No hay movimientos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-3 py-2 text-left">Código</th>
                  <th className="border px-3 py-2 text-left">Cuenta</th>
                  <th className="border px-3 py-2 text-right">Balance Inicial</th>
                  <th className="border px-3 py-2 text-right">Débito</th>
                  <th className="border px-3 py-2 text-right">Crédito</th>
                  <th className="border px-3 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.account_code + r.account_name}>
                    <td className="border px-3 py-2 font-mono">{r.account_code}</td>
                    <td className="border px-3 py-2">{r.account_name}</td>
                    <td className="border px-3 py-2 text-right">{fmtUSD(r.initial)}</td>
                    <td className="border px-3 py-2 text-right">{fmtUSD(r.debit)}</td>
                    <td className="border px-3 py-2 text-right">{fmtUSD(r.credit)}</td>
                    <td className="border px-3 py-2 text-right">{fmtUSD(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="border px-3 py-2" colSpan={2}>Totales</td>
                  <td className="border px-3 py-2 text-right">{fmtUSD(totals.initial)}</td>
                  <td className="border px-3 py-2 text-right">{fmtUSD(totals.debit)}</td>
                  <td className="border px-3 py-2 text-right">{fmtUSD(totals.credit)}</td>
                  <td className="border px-3 py-2 text-right">{fmtUSD(totals.balance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Botón Exportar */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={exportToPDF}
            className="px-6 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700"
          >
            📄 Exportar PDF
          </button>
        </div>
      </div>
    </div>
  );
}