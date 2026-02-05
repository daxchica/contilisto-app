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

/* -------------------------------------------------------------------------- */
/* CONFIG                                                                      */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function getParentCode(code: string): string | null {
  if (code.length <= 1) return null;
  if (code.length <= 3) return code.slice(0, 1);
  if (code.length <= 5) return code.slice(0, 3);
  if (code.length <= 7) return code.slice(0, 5);
  return code.slice(0, code.length - 2);
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

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

  /* ------------------------------------------------------------------------ */
  /* FILTER ENTRIES (Balance inicial SIEMPRE entra)                            */
  /* ------------------------------------------------------------------------ */

  const filteredEntries = useMemo(() => {
    const byEntity = entries.filter((e) => e.entityId === entityId);
    if (!startDate && !endDate) return byEntity;

    const from = startDate ? new Date(startDate) : null;
    const to = endDate ? new Date(endDate) : null;

    return byEntity.filter((e) => {
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

  /* ------------------------------------------------------------------------ */
  /* INITIAL BALANCES (never date-filtered)                                   */
  /* ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------ */
  /* RESULTADO DEL EJERCICIO                                                   */
  /* ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------ */
  /* BUILD BALANCE SHEET (JOURNAL-AUTHORITATIVE)                               */
  /* ------------------------------------------------------------------------ */

  const groupedAccounts = useMemo(() => {
    /* 1️⃣ Accounts used in Trial Balance */
    const usedAccountCodes = new Set([
      ...Object.keys(groupedEntries),
      ...Object.keys(initialByCode),
    ]);

    /* 2️⃣ Expand with parents */
    const requiredCodes = new Set<string>();
    for (const code of usedAccountCodes) {
      let cur: string | null = code;
      while (cur) {
        requiredCodes.add(cur);
        cur = getParentCode(cur);
      }
    }

    /* 3️⃣ Only Balance Sheet groups (1–3) */
    const bsCodes = Array.from(requiredCodes).filter((c) =>
      ["1", "2", "3"].includes(c.charAt(0))
    );

    /* 4️⃣ COA lookup (names only) */
    const coaByCode = new Map<string, string>(
      ECUADOR_COA.map((a: any) => [a.code, a.name])
    );

    /* 5️⃣ Build rows journal-first */
    const map = new Map<string, Row>();

    for (const code of bsCodes) {
      const g = groupedEntries[code] || { debit: 0, credit: 0 };

      map.set(code, {
        code,
        name: coaByCode.get(code) ?? "CUENTA NO DEFINIDA EN PUC",
        initialBalance: initialByCode[code] || 0,
        debit: g.debit,
        credit: g.credit,
        balance: 0,
        level: detectLevel(code),
        parent: getParentCode(code),
      });
    }

    /* 6️⃣ Inject Resultado del Ejercicio */
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

    /* 7️⃣ Roll-up bottom-up */
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

    /* 8️⃣ Compute balances */
    for (const row of map.values()) {
      const group = row.code.charAt(0);
      if (group === "1")
        row.balance = row.initialBalance + row.debit - row.credit;
      else
        row.balance = row.initialBalance - row.debit + row.credit;
    }

    return Array.from(map.values())
      .filter((r) => r.level <= level)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [groupedEntries, initialByCode, resultadoDelEjercicio, level]);

  /* ------------------------------------------------------------------------ */
  /* VISIBILITY                                                               */
  /* ------------------------------------------------------------------------ */

  const isVisible = (acc: Row) => {
    if (!acc.parent) return true;
    for (const code of collapsedCodes) {
      if (acc.code.startsWith(code) && acc.code !== code) return false;
    }
    return true;
  };

  /* ------------------------------------------------------------------------ */
  /* EXPORTS                                                                  */
  /* ------------------------------------------------------------------------ */

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
    a.download = "balance-general.csv";
    a.click();
  };

  /* ------------------------------------------------------------------------ */
  /* RENDER                                                                  */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row justify-between gap-3 mb-3">
        <h1 className="text-lg font-bold text-blue-800">📘 Balance General</h1>

        <div className="flex gap-2 items-center">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>
                Nivel {l}
              </option>
            ))}
          </select>

          <button onClick={exportPDF} className="btn-primary">
            📄 PDF
          </button>
          <button onClick={exportCSV} className="btn-success">
            📊 CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c} className="px-3 py-2 text-left">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupedAccounts.filter(isVisible).map((acc) => (
              <tr key={acc.code} className="border-t">
                <td className="px-3 py-1 font-semibold">{acc.code}</td>
                <td className="px-3 py-1">
                  {" ".repeat((acc.level - 1) * 2)}
                  {acc.name}
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
                <td className="px-3 py-1 text-right">
                  {formatAmount(acc.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}