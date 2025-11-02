// src/components/BalanceSheet.tsx
import React, { useMemo, useState } from "react";
import type { JournalEntry } from "../types/JournalEntry";
import { formatAmount } from "../utils/accountingUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";
import ECUADOR_COA from "../../shared/coa/ecuador_coa";
import { groupEntriesByAccount, detectLevel } from "@/utils/groupJournalEntries";

const COLUMNS = ["Código", "Cuenta", "Saldo Inicial", "Débito", "Crédito", "Saldo"] as const;

interface Props {
  entries: JournalEntry[];
  resultadoDelEjercicio: number;
  entityId: string;
}

type Row = {
  code: string;
  name: string;
  initialBalance: number;
  debit: number;
  credit: number;
  balance: number;
  level: number;
  parent: string | null;
};

function getParentCode(code: string): string | null {
  if (code.length <= 1) return null;
  if (code.length <= 3) return code.slice(0, 1);
  if (code.length <= 5) return code.slice(0, 3);
  if (code.length <= 7) return code.slice(0, 5);
  return code.slice(0, code.length - 2);
}

export default function BalanceSheet({ entries, resultadoDelEjercicio, entityId }: Props) {
  const [level, setLevel] = useState(5);
  const [collapsedCodes, setCollapsedCodes] = useState<Set<string>>(new Set());

  const toggleCollapse = (code: string) => {
    const updated = new Set(collapsedCodes);
    updated.has(code) ? updated.delete(code) : updated.add(code);
    setCollapsedCodes(updated);
  };

  const groupedEntries = useMemo(
    () => groupEntriesByAccount(entries.filter(e => e.entityId === entityId)), 
    [entries, entityId]
  );

  const groupedAccounts = useMemo(() => {
    // Only 1/2/3 groups; restrict Patrimonio to (301,306,307*)
    const eligible = ECUADOR_COA.filter(acc => {
      const f = acc.code[0];
      if (!["1", "2", "3"].includes(f)) return false;
      if (acc.code.startsWith("3")) {
        // Show only patrimonio core + resultados + resultado del ejercicio tree
        return /^3(01|06|07)/.test(acc.code);
      }
      return true;
    });

    // Build quick child map to know if an account is a parent
    const childrenByParent = new Map<string, string[]>();
    for (const acc of eligible) {
      const parent = getParentCode(acc.code);
      if (parent) {
        if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
        childrenByParent.get(parent)!.push(acc.code);
      }
    }
    const isLeaf = (code: string) => !childrenByParent.has(code);

    // 1) Seed rows: leaf rows get raw (initial/debit/credit) from ledger; parents start at 0
    const map = new Map<string, Row>();
    for (const acc of eligible) {
      const code = acc.code;
      const g = groupedEntries[code] || { initial: 0, debit: 0, credit: 0 };

      map.set(code, {
        code,
        name: acc.name,
        initialBalance: isLeaf(code) ? g.initial : 0,
        debit: isLeaf(code) ? g.debit : 0,
        credit: isLeaf(code) ? g.credit : 0,
        balance: 0, // filled after roll-up
        level: detectLevel(code),
        parent: getParentCode(code),
      });
    }

    // 2️⃣ Add resultado del ejercicio
    if (!map.has("307")) {
      map.set("307", {
        code: "307",
        name: "RESULTADO DEL EJERCICIO",
        initialBalance: 0,
        debit: 0,
        credit: 0,
        balance: resultadoDelEjercicio,
        level: 2,
        parent: "3",
      });
    }
    if (!map.has("3")) {
      map.set("3", {
        code: "3",
        name: "PATRIMONIO NETO",
        initialBalance: 0,
        debit: 0,
        credit: 0,
        balance: 0,
        level: 1,
        parent: null,
      });
    }

    if (resultadoDelEjercicio > 0) {
      map.set("30701", {
        code: "30701",
        name: "GANANCIA NETA DEL PERIODO",
        initialBalance: 0,
        debit: 0,
        credit: resultadoDelEjercicio,
        balance: 0,
        level: 3,
        parent: "307",
      });
    } else if (resultadoDelEjercicio < 0) {
      map.set("30702", {
        code: "30702",
        name: "PÉRDIDA NETA DEL EJERCICIO",
        initialBalance: 0,
        debit: Math.abs(resultadoDelEjercicio),
        credit: 0,
        balance: 0,
        level: 3,
        parent: "307",
      });
    }

    // Make sure parents referenced by injected nodes exist in children map (for roll-up)
    for (const row of map.values()) {
      if (row.parent) {
        if (!childrenByParent.has(row.parent)) childrenByParent.set(row.parent, []);
        if (!childrenByParent.get(row.parent)!.includes(row.code)) {
          childrenByParent.get(row.parent)!.push(row.code);
        }
      }
    }

    // 3️⃣ Bottom-up propagation (aggregate child balances)
    const allCodes = Array.from(map.keys()).sort((a, b) => b.length - a.length);
    for (const code of allCodes) {
      const row = map.get(code)!;
      if (!row.parent) continue;
      const parent = map.get(row.parent);
      if (!parent) continue;
      parent.initialBalance += row.initialBalance;
      parent.debit += row.debit;
      parent.credit += row.credit;
  };

  // 4) Compute balances using the group rule
  for (const row of map.values()) {
    const first = row.code.charAt(0);
    if (first === "1") {
      row.balance = row.initialBalance + row.debit - row.credit;
    } else if (first === "2" || first === "3") {
      row.balance = row.initialBalance - row.debit + row.credit;
    } else {
      row.balance = 0;
    }
  }
  
  // 5️⃣ Apply visualization level filter
  const filtered = Array.from(map.values()).filter((acc) => acc.level <= level);
  // Sort
  return filtered.sort((a, b) => a.code.localeCompare(b.code));
}, [groupedEntries, resultadoDelEjercicio, level]);

  // Collapse visibility
  const isVisible = (acc: Row) => {
    if (!acc.parent) return true;
    for (const code of collapsedCodes) {
      if (acc.code.startsWith(code) && acc.code !== code) return false;
    }
    return true;
  };

  // Exportar a PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Balance General", 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [[...COLUMNS]],
      body: groupedAccounts.map((acc) => [
        acc.code,
        acc.name,
        formatAmount(acc.initialBalance),
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
        formatAmount(acc.initialBalance),
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
            <label htmlFor="nivel" className="text-sm text-gray-700">
              Nivel:
            </label>
            <select
              id="nivel"
              className="border rounded px-2 py-1 text-sm"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((lvl) => (
                <option key={lvl} value={lvl}>
                  Nivel {lvl}
                </option>
              ))}
            </select>
          </div>
          <button 
            onClick={exportPDF} 
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1 rounded"
          >
            📄 Exportar PDF
          </button>
          <button 
            onClick={exportCSV} 
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-1 rounded">
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
            {groupedAccounts.filter(isVisible).map((acc) => {
              const hasChildren = groupedAccounts.some((child) => child.parent === acc.code);
              const isCollapsed = collapsedCodes.has(acc.code);
              return (
                <tr key={acc.code} className="border-t">
                  <td className="px-4 py-2 font-bold">{acc.code}</td>
                  <td className="px-4 py-2">
                    <span
                      onClick={() => hasChildren && toggleCollapse(acc.code)}
                      className={`cursor-pointer select-none ${
                        hasChildren ? "text-blue-600 font-semibold" : ""}`}
                    >
                      {`${"    ".repeat(acc.level - 1)}${
                        hasChildren ? (isCollapsed ? "► " : "▼ ") : ""}${acc.name}`}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">{formatAmount(acc.initialBalance)}</td>
                  <td className="px-4 py-2 text-right">{formatAmount(acc.debit)}</td>
                  <td className="px-4 py-2 text-right">{formatAmount(acc.credit)}</td>
                  <td className={`px-4 py-2 text-right ${
                    acc.balance < 0 ? "text-red-600 font-semibold" : ""}`}>
                    {formatAmount(acc.balance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}