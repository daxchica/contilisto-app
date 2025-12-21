// src/components/BalanceSheet.tsx
import React, { useMemo, useState } from "react";
import type { JournalEntry } from "../types/JournalEntry";
import { formatAmount } from "../utils/accountingUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";
import ECUADOR_COA from "@/../shared/coa/ecuador_coa";
import { groupEntriesByAccount, detectLevel } from "@/utils/groupJournalEntries";
import { useInitialBalances } from "@/hooks/useInitialBalances";

const COLUMNS = [
  "Código",
  "Cuenta",
  "Saldo Inicial",
  "Débito",
  "Crédito",
  "Saldo",
] as const;

interface Props {
  entries: JournalEntry[];
  resultadoDelEjercicio?: number;
  entityId: string;
  startDate?: string;
  endDate?: string;
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

export default function BalanceSheet({
  entries,
  resultadoDelEjercicio: resultadoProp,
  entityId,
  startDate,
  endDate,
}: Props) {
  const [level, setLevel] = useState(5);
  const [collapsedCodes, setCollapsedCodes] = useState<Set<string>>(new Set());
  const initialBalances = useInitialBalances();

  const toggleCollapse = (code: string) => {
    setCollapsedCodes((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  // ---------------------------------------------------------
  // DATE FILTERING (Balance Inicial SIEMPRE incluido)
  // ---------------------------------------------------------
  const filteredEntries = useMemo(() => {
    const byEntity = entries.filter((e) => e.entityId === entityId);
    if (!startDate && !endDate) return byEntity;

    const from = startDate ? new Date(startDate) : null;
    const to = endDate ? new Date(endDate) : null;

    return byEntity.filter((e) => {
      // ✅ Balance inicial siempre entra
      if (e.source === "initial") return true;

      if (!e.date) return false;
      const d = new Date(e.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [entries, entityId, startDate, endDate]);

  const groupedEntries = useMemo(
    () => groupEntriesByAccount(filteredEntries),
    [filteredEntries]
  );

  // ---------------------------------------------------------
  // Account initial balances (NEVER filtered by date)
  // ---------------------------------------------------------
  const initialByCode = useMemo(() => {
    const map: Record<string, number> = {};

    for (const b of initialBalances) {
      const code = (b.account_code || "").trim();
      if (!code) continue;

      const balEntityId = (b as any).entityId as string | undefined;
      if (balEntityId && balEntityId !== entityId) continue;

      map[code] = (map[code] || 0) + Number(b.initial_balance || 0);
    }
    return map;
  }, [initialBalances, entityId]);

  // ---------------------------------------------------------------------
  // Net result of the fiscal period (if not provided externally via prop)
  // ---------------------------------------------------------------------
  const resultadoDelEjercicio = useMemo(() => {
    if (typeof resultadoProp === "number") return resultadoProp;

    const sumByPrefix = (prefix: string, side: "debit" | "credit") =>
      filteredEntries
        .filter((e) => (e.account_code || "").startsWith(prefix))
        .reduce((acc, e) => acc + Number((e as any)[side] || 0), 0);

    const ventas = sumByPrefix("7", "credit");
    const gastos = sumByPrefix("5", "debit");
    return ventas - gastos;
  }, [resultadoProp, filteredEntries]);

  // -------------------------------------------------------------------------
  // Construct hierarchical Balance Sheet following Ecuadorian PUC structure
  // -------------------------------------------------------------------------
  const groupedAccounts = useMemo(() => {
    const eligible = ECUADOR_COA.filter((acc) => {
      const f = acc.code[0];
      if (!["1", "2", "3"].includes(f)) return false;
      if (acc.code.startsWith("3")) return /^3(01|06|07)/.test(acc.code);
      return true;
    });

    const childrenByParent = new Map<string, string[]>();
    for (const acc of eligible) {
      const parent = getParentCode(acc.code);
      if (parent) {
        if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
        childrenByParent.get(parent)!.push(acc.code);
      }
    }
    const isLeaf = (code: string) => !childrenByParent.has(code);

    const map = new Map<string, Row>();
    for (const acc of eligible) {
      const code = acc.code;
      const g = groupedEntries[code] || { debit: 0, credit: 0 };

      map.set(code, {
        code,
        name: acc.name,
        initialBalance: initialByCode[code] || 0,
        debit: isLeaf(code) ? g.debit : 0,
        credit: isLeaf(code) ? g.credit : 0,
        balance: 0,
        level: detectLevel(code),
        parent: getParentCode(code),
      });
    }

    // Inject resultado del ejercicio
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

    if (!map.has("307")) {
      map.set("307", {
        code: "307",
        name: "RESULTADO DEL EJERCICIO",
        initialBalance: 0,
        debit: 0,
        credit: 0,
        balance: 0,
        level: 2,
        parent: "3",
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

    // Ensure relations exist
    for (const row of map.values()) {
      if (!row.parent) continue;
      if (!childrenByParent.has(row.parent)) childrenByParent.set(row.parent, []);
      const arr = childrenByParent.get(row.parent)!;
      if (!arr.includes(row.code)) arr.push(row.code);
    }

    // Bottom-up rollup
    const allCodes = Array.from(map.keys()).sort((a, b) => b.length - a.length);
    for (const code of allCodes) {
      const row = map.get(code)!;
      if (!row.parent) continue;
      const parent = map.get(row.parent);
      if (!parent) continue;

      parent.initialBalance += row.initialBalance;
      parent.debit += row.debit;
      parent.credit += row.credit;
    }

    // Compute balances by group rule
    for (const row of map.values()) {
      const group = row.code.charAt(0);
      if (group === "1") row.balance = row.initialBalance + row.debit - row.credit;
      else if (group === "2" || group === "3") row.balance = row.initialBalance - row.debit + row.credit;
      else row.balance = 0;
    }

    return Array.from(map.values())
      .filter((acc) => acc.level <= level)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [groupedEntries, initialByCode, resultadoDelEjercicio, level]);

  // Collapse visibility
  const isVisible = (acc: Row) => {
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
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", "balance-general.csv");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
        <h1 className="text-lg font-bold text-blue-800">📘 Balance General</h1>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="nivel" className="text-sm text-gray-600">
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

          <button
            onClick={exportPDF}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded"
          >
            📄 Exportar PDF
          </button>

          <button
            onClick={exportCSV}
            className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded"
          >
            📊 Exportar CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200 text-sm">
          <thead className="bg-gray-100">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {groupedAccounts.filter(isVisible).map((acc) => {
              const hasChildren = groupedAccounts.some(
                (child) => child.parent === acc.code
              );
              const isCollapsed = collapsedCodes.has(acc.code);

              return (
                <tr key={acc.code} className="border-t">
                  <td className="px-3 py-1 font-semibold">{acc.code}</td>

                  <td className="px-3 py-1">
                    <span
                      onClick={() => hasChildren && toggleCollapse(acc.code)}
                      className={`cursor-pointer select-none ${
                        hasChildren ? "text-blue-600 font-semibold" : ""
                      }`}
                    >
                      {`${"    ".repeat(acc.level - 1)}${
                        hasChildren ? (isCollapsed ? "► " : "▼ ") : ""
                      }${acc.name}`}
                    </span>
                  </td>

                  <td className="px-3 py-1 text-right">
                    {formatAmount(acc.initialBalance)}
                  </td>
                  <td className="px-3 py-1 text-right">
                    {formatAmount(acc.debit)}
                  </td>
                  <td className="px-3 py-1 text-right">
                    {formatAmount(acc.credit)}
                  </td>
                  <td
                    className={`px-3 py-1 text-right ${
                      acc.balance < 0 ? "text-red-600 font-semibold" : ""
                    }`}
                  >
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