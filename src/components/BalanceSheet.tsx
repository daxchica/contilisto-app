// ============================================================================
// src/components/BalanceSheet.tsx
// CONTILISTO — Balance General (ACCOUNTING-CORRECT FINAL VERSION)
// - Injects Resultado del Ejercicio (307)
// - Ensures 1 = 2 + 3
// - Keeps accounting logic intact
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
import { getDefaultInitialBalanceDate } from "@/utils/dateUtils";

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
  startDate?: string;
  endDate?: string;
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

const toISO = (v?: string) => (v ?? "").slice(0, 10);

const safe = (v: any) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Number(Number(n || 0).toFixed(2));

/**
 * Finds the nearest existing parent code by trimming the right side
 * until a code exists in the map.
 *
 * Example: 307 -> 30 (missing) -> 3 (exists) => parent = "3"
 */
function findNearestExistingParent(code: string, exists: (c: string) => boolean) {
  let p = code.slice(0, -1);
  while (p.length >= 1) {
    if (exists(p)) return p;
    p = p.slice(0, -1);
  }
  return null;
}

/**
 * Ensure parent chain exists in the map so hierarchy can roll up step-by-step.
 * We add:
 * - group headers "1","2","3"
 * - any intermediate prefixes that exist in COA (optional but helps levels)
 */
function ensureParents(
  code: string,
  map: Map<string, Row>,
  coaByCode: Map<string, string>
) {
  // Always ensure group header
  const group = code.charAt(0);
  if (["1", "2", "3"].includes(group) && !map.has(group)) {
    map.set(group, {
      code: group,
      name:
        group === "1" ? "ACTIVO" : group === "2" ? "PASIVO" : "PATRIMONIO NETO",
      initialBalance: 0,
      debit: 0,
      credit: 0,
      balance: 0,
      level: detectLevel(group),
    });
  }

  // Add intermediate COA prefixes if present (prevents jump directly to group)
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
  startDate,
  endDate,
  showHeader = true,
}: Props) {
  const [level, setLevel] = useState(5);

  const effectiveStart = startDate ?? getDefaultInitialBalanceDate();
  const fromISO = toISO(effectiveStart);
  const toISODate = toISO(endDate);
  const resultado = resultadoDelEjercicio ?? 0;

  /* ------------------------------------------------------------------------ */
  /* FILTER ENTRIES                                                           */
  /* ------------------------------------------------------------------------ */

  const filteredEntries = useMemo(() => {
    return (entries ?? []).filter((e) => {
      if (e.entityId !== entityId) return false;

      if (e.source === "initial") return true;

      const d = toISO(e.date);
      if (!d) return false;

      if (fromISO && d < fromISO) return false;
      if (toISODate && d > toISODate) return false;

      return true;
    });
  }, [entries, entityId, fromISO, toISODate]);

  const groupedEntries = useMemo(() => groupEntriesByAccount(filteredEntries),
    [filteredEntries]
  );

  /* ------------------------------------------------------------------------ */
  /* CALCULATE RESULTADO DEL EJERCICIO                                       */
  /* ------------------------------------------------------------------------ */

 

  /* ------------------------------------------------------------------------ */
  /* BUILD BALANCE SHEET                                                      */
  /* ------------------------------------------------------------------------ */

  const groupedAccounts = useMemo(() => {
    const coaByCode = new Map<string, string>(
      ECUADOR_COA.map((a: any) => [String(a.code), String(a.name)])
    );

    const allCodes = Object.keys(groupedEntries);

    // LEAF = code that is NOT a prefix of any other code
    const leafCodes = allCodes
      .filter((code) => {
        if (!code) return false;
        const g = code.charAt(0);
        if (!["1", "2", "3"].includes(g)) return false;
        return !allCodes.some((other) => other !== code && other.startsWith(code));
      })
      .sort((a, b) => a.localeCompare(b, "es"));

    // Map where ONLY leaves carry values; parents start at 0
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
        // Activo
        initialBalance = initialDebit - initialCredit;
        balance = initialBalance + debit - credit;
      } else {
        // Pasivo & Patrimonio
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

    // Ensure group headers exist even if no leaf present
    ensureParents("1", map, coaByCode);
    ensureParents("2", map, coaByCode);
    ensureParents("3", map, coaByCode);

    // Inject 307 as a LEAF under group 3
    if (!map.has("307")) {
      map.set("307", {
        code: "307",
        name: "RESULTADO DEL EJERCICIO",
        initialBalance: 0,
        // Profit increases equity => credit; loss decreases equity => debit
        debit: resultado < 0 ? round2(Math.abs(resultado)) : 0,
        credit: resultado > 0 ? round2(resultado) : 0,
        balance: round2(resultado),
        level: detectLevel("307"),
      });
      ensureParents("307", map, coaByCode);
    }

    // Roll up children into parents (children first)
    const exists = (c: string) => map.has(c);
    const codesByDepth = Array.from(map.keys()).sort((a, b) => b.length - a.length);

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
  /* EXPORTS                                                                  */
  /* ------------------------------------------------------------------------ */

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(
      `Balance General (${fromISO || "-"} → ${toISODate || "Hoy"})`,
      14,
      14
    );

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

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
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
              className="px-3 py-1.5 bg-blue-700 text-white rounded">
              Exportar PDF
            </button>

            <button
              onClick={exportCSV}
              className="px-3 py-1.5 bg-emerald-700 text-white rounded">
              Exportar CSV
            </button>
          </div>
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