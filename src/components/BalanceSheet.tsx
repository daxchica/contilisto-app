import React, { useMemo, useState } from "react";
import type { JournalEntry } from "../types/JournalEntry";
import { formatAmount } from "../utils/accountingUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";
import ECUADOR_COA from "../../shared/coa/ecuador_coa";
import { groupEntriesByAccount, detectLevel } from "@/utils/groupJournalEntries";

const COLUMNS = ["Código", "Cuenta", "Saldo Inicial", "Débito", "Crédito", "Saldo"] as const;

function getParentCodeByLevel(code: string): string | null {
  if (code.length <=1) return null;
  return code.slice(0, code.length - 2);
}

interface Props {
  entries: JournalEntry[];
  resultadoDelEjercicio: number;
  entityId: string;
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
    const map = new Map<string, any>();

    for (const acc of ECUADOR_COA) {
      const code = acc.code;
      const levelDetected = detectLevel(code);
      if (levelDetected > level) continue;
      if (!["1", "2", "3"].includes(code[0])) continue;
        
      const group = groupedEntries[code] || { debit: 0, credit: 0, initial: 0 };

      const balance = code.startsWith("1")
      ? group.initial + group.debit - group.credit
      : group.initial - group.debit + group.credit;

      map.set(acc.code, {
        code,
        name: acc.name,
        debit: group.debit,
        credit: group.credit,
        balance,
        initialBalance: group.initial,
        level: levelDetected,
        parent: getParentCodeByLevel(acc.code),
      });
    }
  
    // Resultado del ejercicio
    map.set("307", {
      code: "307",
      name: "RESULTADO DEL EJERCICIO",
      debit: 0,
      credit: 0,
      balance: 0,
      initialBalance: 0,
      level: 2,
      parent: "3",
    });
    map.set("30701", {
      code: "30701",
      name: "GANANCIA NETA DEL PERIODO",
      debit: 0,
      credit: 0,
      balance: resultadoDelEjercicio > 0 ? resultadoDelEjercicio : 0,
      initialBalance: 0,
      level: 3,
      parent: "307",
    });
    map.set("30702", {
      code: "30702",
      name: "PÉRDIDA NETA DEL EJERCICIO",
      debit: 0,
      credit: 0,
      balance: resultadoDelEjercicio < 0 ? resultadoDelEjercicio : 0,
      initialBalance: 0,
      level: 3,
      parent: "307",
    });

    // Propagar montos hacia padres
    const allAccounts = Array.from(map.values()).sort((a, b) => b.code.length - a.code.length);
    for (const acc of allAccounts) {
      if (!acc.parent) continue;
      const parent = map.get(acc.parent);
      if (parent) {
        parent.initialBalance += acc.initialBalance;
        parent.debit += acc.debit;
        parent.credit += acc.credit;
        parent.balance += acc.balance;
      }
    }

    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [groupedEntries, level, resultadoDelEjercicio, entityId]);

  const isVisible = (acc: { code: string; parent: string | null }) => {
    if (!acc.parent) return true;
    for (const code of collapsedCodes) {
      if (acc.code.startsWith(code) && acc.code !== code) return false;
    }
    return true;
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Balance General", 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [[...COLUMNS]],
      body: groupedAccounts.map((acc) => [
        acc.code,
        acc.name.replace(/\u00a0/g, " "),
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
            <label htmlFor="nivel" className="text-sm text-gray-700">Nivel:</label>
            <select
              id="nivel"
              className="border rounded px-2 py-1 text-sm"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((lvl) => (
                <option key={lvl} value={lvl}>Nivel {lvl}</option>
              ))}
            </select>
          </div>
          <button onClick={exportPDF} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1 rounded">
            📄 Exportar PDF
          </button>
          <button onClick={exportCSV} className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-1 rounded">
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
                      className={`cursor-pointer select-none ${hasChildren ? "text-blue-600 font-semibold" : ""}`}
                    >
                      {`${"    ".repeat(acc.level - 1)}${hasChildren ? (isCollapsed ? "► " : "▼ ") : ""}${acc.name}`}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">{formatAmount(acc.initialBalance)}</td>
                  <td className="px-4 py-2 text-right">{formatAmount(acc.debit)}</td>
                  <td className="px-4 py-2 text-right">{formatAmount(acc.credit)}</td>
                  <td className={`px-4 py-2 text-right ${acc.balance < 0 ? "text-red-600 font-semibold" : ""}`}>
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