// src/components/BalanceSheet.tsx
import React, { useMemo, useState } from "react";
import type { JournalEntry } from "../types/JournalEntry";
import { formatAmount } from "../utils/accountingUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";
import ECUADOR_COA from "../../shared/coa/ecuador_coa";

const COLUMNS = ["Codigo", "Cuenta", "Balance Inicial", "Débito", "Crédito", "Saldo"] as const;

function detectLevel(code: string): number {
  if (code.length === 1) return 1;
  if (code.length === 3) return 2;
  if (code.length === 5) return 3;
  if (code.length === 7) return 4;
  return 5;
}

function getParentCodeByLevel(code: string, level: number): string {
  return code.slice(0, level === 1 ? 1 : level === 2 ? 3 : level === 3 ? 5 : level === 4 ? 7 : 9);
}

function padLeftForLevel(text: string, level: number): string {
  const indent = "&nbsp;&nbsp;&nbsp;&nbsp;".repeat(level - 1);
  return `${indent}${text}`;
}

interface Props {
  entries: JournalEntry[];
  result?: number;
}

export default function BalanceSheet({ entries, result = 0 }: Props) {
  const [level, setLevel] = useState(5);
  const [collapsedLevels, setCollapsedLevels] = useState<number[]>([]);

  const toggleCollapseLevel = (lvl: number) => {
    setCollapsedLevels((prev) =>
      prev.includes(lvl) ? prev.filter((l) => l !== lvl) : [...prev, lvl]
    );
  };

  const groupedAccounts = useMemo(() => {
    const map = new Map<string, {
      code: string;
      name: string;
      debit: number;
      credit: number;
      level: number;
    }>();

    // Step 1: Initialize map with accounts from COA up to selected level
    for (const acc of ECUADOR_COA) {
      const lvl = detectLevel(acc.code);
      const group = acc.code.slice(0, 1);
      if (lvl <= level && ["1", "2", "3"].includes(group)) {
        map.set(acc.code, {
          code: acc.code,
          name: acc.name,
          debit: 0,
          credit: 0,
          level: lvl,
        });
      }
    }

    // Step 2: Add journal entry values to corresponding accounts by hierarchy
    for (const entry of entries) {
      const entryLevel = detectLevel(entry.account_code);
      const group = entry.account_code.slice(0, 1);
      if (["1", "2", "3"].includes(group)) {
        for (let l = 1; l <= Math.min(entryLevel, level); l++) {
          const parentCode = getParentCodeByLevel(entry.account_code, l);
          const acc = map.get(parentCode);
          if (acc) {
            acc.debit += entry.debit || 0;
            acc.credit += entry.credit || 0;
          }
        }
      }
    }

    // 3. Add Result of the Period (Resultado del Ejercicio)
    
    const resultCode = result >= 0 ? "30701" : "30702";
    const resultName = result >= 0 ? "GANANCIA NETA DEL PERIODO" : "PÉRDIDA NETA DEL EJERCICIO";
    
    if (!map.has(resultCode)) {
      map.set(resultCode, {
        code: resultCode,
        name: resultName,
        debit: 0,
        credit: 0,
        level: 5,
      });
    }

    const resultAcc = map.get(resultCode);
    if (resultAcc) {
      if (result >= 0) {
        resultAcc.credit += result;
      } else {
        resultAcc.debit += Math.abs(result);
      }
    
      // Propagate to parent levels (307 and 3)
      const parentCodes = ["307", "3"];
      for (const parentCode of parentCodes) {
        const parentAcc = map.get(parentCode);
        if (parentAcc) {
          parentAcc.debit += resultAcc.debit;
          parentAcc.credit += resultAcc.credit;
        }
      }
    }
  
    return Array.from(map.values())
      .map((acc) => ({
        ...acc,
        balance: acc.debit - acc.credit,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [entries, level, result]);


const exportPDF = () => {
  const doc = new jsPDF();
  doc.text("Balance General", 14, 14);
  autoTable(doc, {
    startY: 20,
    head: [[...COLUMNS]],
    body: groupedAccounts.map((acc) => [
      acc.code,
      acc.name.replace(/\u00a0/g, " "),
      "-",
      formatAmount(acc.debit),
      formatAmount(acc.credit),
      formatAmount(acc.balance),
    ]),
  });
  doc.save("balance-general.pdf");
};

  const exportCSV = () => {
    const csv = Papa.unparse({
      fields: [...COLUMNS],
      data: groupedAccounts.map((acc) => [
        acc.code,
        acc.name.replace(/\u00a0/g, " "),
        "-",
        formatAmount(acc.debit),
        formatAmount(acc.credit),
        formatAmount(acc.balance),
      ]),
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
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            >
              <option value={1}>Nivel 1</option>
              <option value={2}>Nivel 2</option>
              <option value={3}>Nivel 3</option>
              <option value={4}>Nivel 4</option>
              <option value={5}>Nivel 5</option>
            </select>
          </div>

          <button
            onClick={exportPDF}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1 rounded">
            📄 Exportar PDF
          </button>

          <button
            onClick={exportCSV}
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
              {COLUMNS.map((col) => (
                <th key={col} className="px-4 py-2 text-left">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupedAccounts.map((acc) => (
              <tr key={acc.code} className="border-t">
                <td className="px-4 py-2 font-bold">{acc.code}</td>
                <td className="px-4 py-2" dangerouslySetInnerHTML={{ __html: padLeftForLevel(acc.name, acc.level) }} />
                <td className="px-4 py-2 text-right">-</td>
                <td className="px-4 py-2 text-right">{formatAmount(acc.debit)}</td>
                <td className="px-4 py-2 text-right">{formatAmount(acc.credit)}</td>
                <td className="px-4 py-2 text-right">{formatAmount(acc.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}