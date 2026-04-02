// ============================================================================
// src/components/BalanceSheet.tsx
// CONTILISTO — Balance General (ACCOUNTING-CORRECT FINAL VERSION)
// IMPROVEMENTS:
// - Safe filtering
// - Prevents double counting of Resultado del Ejercicio (307)
// - Validates accounting equation (1 = 2 + 3)
// - Performance optimized
// - Fully trusts parent data
// ============================================================================

import React, { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";

import type { JournalEntry } from "../types/JournalEntry";
import { formatAmount } from "../utils/accountingUtils";

import ECUADOR_COA from "@/../shared/coa/ecuador_coa";
import {
  groupEntriesByAccount,
  detectLevel,
} from "@/utils/groupJournalEntries";

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
  entityId: string;
  resultadoDelEjercicio: number;
  showHeader?: boolean;
}

type Row = {
  code: string;
  name: string;
  initialBalance: number;
  debit: number;
  credit: number;
  balance: number;
  level: number;
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                     */
/* -------------------------------------------------------------------------- */

const safe = (v: any) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Number(Number(n || 0).toFixed(2));

function findNearestExistingParent(code: string, exists: (c: string) => boolean) {
  let p = code.slice(0, -1);
  while (p.length >= 1) {
    if (exists(p)) return p;
    p = p.slice(0, -1);
  }
  return null;
}

function ensureParents(
  code: string,
  map: Map<string, Row>,
  coaByCode: Map<string, string>
) {
  const group = code.charAt(0);

  if (["1", "2", "3"].includes(group) && !map.has(group)) {
    map.set(group, {
      code: group,
      name:
        group === "1"
          ? "ACTIVO"
          : group === "2"
          ? "PASIVO"
          : "PATRIMONIO NETO",
      initialBalance: 0,
      debit: 0,
      credit: 0,
      balance: 0,
      level: detectLevel(group),
    });
  }

  let p = code.slice(0, -1);
  while (p.length >= 1) {
    if (!map.has(p) && coaByCode.has(p)) {
      map.set(p, {
        code: p,
        name: coaByCode.get(p) || "CUENTA NO DEFINIDA EN PUC",
        initialBalance: 0,
        debit: 0,
        credit: 0,
        balance: 0,
        level: detectLevel(p),
      });
    }
    p = p.slice(0, -1);
  }
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                   */
/* -------------------------------------------------------------------------- */

export default function BalanceSheet({
  entries,
  entityId,
  resultadoDelEjercicio,
  showHeader = true,
}: Props) {
  const [level, setLevel] = useState(5);

  const resultado = resultadoDelEjercicio ?? 0;

  /* ------------------------------------------------------------------------ */
  /* SAFE FILTERING (TRUST PARENT BUT PROTECT SYSTEM)                          */
  /* ------------------------------------------------------------------------ */

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (!e.account_code) return false;
      if (!e.entityId) return false;
      return true;
    });
  }, [entries]);

  const groupedEntries = useMemo(
    () => groupEntriesByAccount(filteredEntries),
    [filteredEntries]
  );

  /* ------------------------------------------------------------------------ */
  /* BUILD BALANCE SHEET                                                      */
  /* ------------------------------------------------------------------------ */

  const groupedAccounts = useMemo(() => {
    const coaByCode = new Map<string, string>(
      ECUADOR_COA.map((a: any) => [String(a.code), String(a.name)])
    );

    const allCodes = Object.keys(groupedEntries);
    const codeSet = new Set(allCodes);

    const leafCodes = allCodes
      .filter((code) => {
        if (!code) return false;
        const g = code.charAt(0);
        if (!["1", "2", "3"].includes(g)) return false;

        return ![...codeSet].some(
          (other) => other !== code && other.startsWith(code)
        );
      })
      .sort((a, b) => a.localeCompare(b, "es"));

    const map = new Map<string, Row>();

    for (const code of leafCodes) {
      const group = code.charAt(0);
      const g = groupedEntries[code];

      const initialDebit = safe(g?.initialDebit);
      const initialCredit = safe(g?.initialCredit);
      const debit = safe(g?.debit);
      const credit = safe(g?.credit);

      let initialBalance = 0;
      let balance = 0;

      if (group === "1") {
        initialBalance = initialDebit - initialCredit;
        balance = initialBalance + debit - credit;
      } else {
        initialBalance = initialCredit - initialDebit;
        balance = initialBalance + credit - debit;
      }

      map.set(code, {
        code,
        name: coaByCode.get(code) ?? "CUENTA NO DEFINIDA EN PUC",
        initialBalance: round2(initialBalance),
        debit: round2(debit),
        credit: round2(credit),
        balance: round2(balance),
        level: detectLevel(code),
      });

      ensureParents(code, map, coaByCode);
    }

    ensureParents("1", map, coaByCode);
    ensureParents("2", map, coaByCode);
    ensureParents("3", map, coaByCode);

    /* ---------------------------------------------------------------------- */
    /* SAFE RESULTADO DEL EJERCICIO                                            */
    /* ---------------------------------------------------------------------- */

    const hasChildResult = Array.from(map.keys()).some((c) =>
      c.startsWith("307")
    );

    if (!hasChildResult) {
      map.set("307", {
        code: "307",
        name: "RESULTADO DEL EJERCICIO",
        initialBalance: 0,
        debit: resultado < 0 ? round2(Math.abs(resultado)) : 0,
        credit: resultado > 0 ? round2(resultado) : 0,
        balance: round2(resultado),
        level: detectLevel("307"),
      });

      ensureParents("307", map, coaByCode);
    }

    /* ---------------------------------------------------------------------- */
    /* ROLL-UP                                                                */
    /* ---------------------------------------------------------------------- */

    const exists = (c: string) => map.has(c);
    const codesByDepth = Array.from(map.keys()).sort(
      (a, b) => b.length - a.length
    );

    for (const code of codesByDepth) {
      const row = map.get(code)!;
      const parentCode = findNearestExistingParent(code, exists);
      if (!parentCode) continue;

      const parent = map.get(parentCode)!;

      parent.initialBalance = round2(parent.initialBalance + row.initialBalance);
      parent.debit = round2(parent.debit + row.debit);
      parent.credit = round2(parent.credit + row.credit);
      parent.balance = round2(parent.balance + row.balance);

      map.set(parentCode, parent);
    }

    return Array.from(map.values())
      .filter((r) => r.level <= level)
      .sort((a, b) => a.code.localeCompare(b.code, "es"));
  }, [groupedEntries, level, resultado]);

  /* ------------------------------------------------------------------------ */
  /* ACCOUNTING VALIDATION                                                    */
  /* ------------------------------------------------------------------------ */

  const checkBalance = useMemo(() => {
    const get = (code: string) =>
      groupedAccounts.find((a) => a.code === code)?.balance || 0;

    const activos = get("1");
    const pasivos = get("2");
    const patrimonio = get("3");

    return {
      activos,
      pasivos,
      patrimonio,
      cuadrado: Math.abs(activos - (pasivos + patrimonio)) < 0.01,
    };
  }, [groupedAccounts]);

  /* ------------------------------------------------------------------------ */
  /* EXPORTS                                                                  */
  /* ------------------------------------------------------------------------ */

  const exportPDF = () => {
    const doc = new jsPDF();

    doc.text(`Balance General`, 14, 14);

    autoTable(doc, {
      startY: 20,
      head: [[...COLUMNS]],
      body: groupedAccounts.map((acc) => [
        acc.code,
        acc.name,
        acc.initialBalance.toFixed(2),
        acc.debit.toFixed(2),
        acc.credit.toFixed(2),
        acc.balance.toFixed(2),
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
        acc.initialBalance.toFixed(2),
        acc.debit.toFixed(2),
        acc.credit.toFixed(2),
        acc.balance.toFixed(2),
      ]),
    });

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "balance-general.csv";
    a.click();
  };

  /* ------------------------------------------------------------------------ */
  /* RENDER                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="w-full">
      {showHeader && (
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-blue-800">
            📘 Balance General
          </h2>

          <div className="flex items-center gap-2">
            <label className="text-sm">
              Nivel:
              <select
                className="ml-2 border rounded px-2 py-1"
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={exportPDF}
              className="px-3 py-1.5 bg-blue-700 text-white rounded"
            >
              Exportar PDF
            </button>

            <button
              onClick={exportCSV}
              className="px-3 py-1.5 bg-emerald-700 text-white rounded"
            >
              Exportar CSV
            </button>
          </div>
        </div>
      )}

      {!checkBalance.cuadrado && (
        <div className="mb-3 p-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded">
          ⚠️ Balance no cuadra: Activo ≠ Pasivo + Patrimonio
        </div>
      )}

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
          {groupedAccounts.map((acc) => (
            <tr key={acc.code} className="border-t">
              <td className="px-3 py-1 font-semibold">{acc.code}</td>
              <td className="px-3 py-1">{acc.name}</td>
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
  );
}