// ============================================================================
// src/components/BalanceSheet.tsx
// CONTILISTO — Balance General (PRODUCTION FINAL STABLE)
// ECUADOR PUC COMPATIBLE
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
  rollupAccounts,
} from "@/utils/groupJournalEntries";

/* -------------------------------------------------------------------------- */
/* CONFIG                                                                     */
/* -------------------------------------------------------------------------- */

const COLUMNS = [
  "Código",
  "Cuenta",
  "Saldo Inicial",
  "Débito",
  "Crédito",
  "Saldo",
] as const;

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

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
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const safe = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number): number =>
  Number((n || 0).toFixed(2));

const isBalanceAccount = (code: string) =>
  ["1", "2", "3"].includes(code.charAt(0));

function normalizeBalance(
  code: string,
  saldo: number
): number {
  const group = code.charAt(0);
  // ============================================================
  // ACTIVO
  // ============================================================
  if (group === "1") {
    return saldo;
  }
  // ============================================================
  // PASIVO / PATRIMONIO
  // ============================================================
  return Math.abs(saldo);
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function BalanceSheet({
  entries,
  entityId,
  resultadoDelEjercicio,
  showHeader = true,
}: Props) {
  const [level, setLevel] = useState(5);

  /* ------------------------------------------------------------------------ */
  /* FILTER ENTRIES                                                           */
  /* ------------------------------------------------------------------------ */

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (!e) return false;
      if (!e.account_code?.trim()) return false;
      if (!e.entityId) return false;
      if (entityId && e.entityId !== entityId) return false;
      return true;
    });
  }, [entries, entityId]);

  /* ------------------------------------------------------------------------ */
  /* REAL RESULTADO DEL EJERCICIO                                             */
  /* ------------------------------------------------------------------------ */

  const resultadoReal = useMemo(() => {
    const valid = filteredEntries.filter((e) => {
      const code = e.account_code || "";
      if (e.source === "initial") return false;
      return ["4", "5", "6"].includes(code.charAt(0));
    });

    // INGRESOS (GROUP 4 ECUADOR)
    const ingresos = valid
      .filter((e) => e.account_code?.startsWith("4"))
      .reduce((sum, e) => sum + safe(e.credit) - safe(e.debit), 0);

    // COSTOS (GROUP 6)
    const costos = valid
      .filter((e) => e.account_code?.startsWith("6"))
      .reduce((sum, e) => sum + safe(e.debit) - safe(e.credit), 0);

    // GASTOS (GROUP 5)
    const gastos = valid
      .filter((e) => e.account_code?.startsWith("5"))
      .reduce((sum, e) => sum + safe(e.debit) - safe(e.credit), 0);

    return round2(ingresos - costos - gastos);
  }, [filteredEntries]);

  /* ------------------------------------------------------------------------ */
  /* FINAL RESULT                                                             */
  /* ------------------------------------------------------------------------ */

  const resultado =
    resultadoReal !== 0 ? resultadoReal : safe(resultadoDelEjercicio);

  /* ------------------------------------------------------------------------ */
  /* BUILD BALANCE                                                            */
  /* ------------------------------------------------------------------------ */

  const groupedAccounts = useMemo(() => {
    const coaByCode = new Map<string, string>(
      ECUADOR_COA.map((a: any) => [String(a.code), String(a.name)])
    );

    // ONLY BALANCE SHEET ACCOUNTS
    const balanceEntries = filteredEntries.filter((e) => {
      const code = e.account_code || "";
      return ["1", "2", "3"].includes(code.charAt(0));
    });

    // BASE ENGINE
    const grouped = groupEntriesByAccount(balanceEntries);
    const rolled = rollupAccounts(grouped);

    // REMOVE AUTO GENERATED RESULT ACCOUNTS
    delete rolled["307"];
    delete rolled["30701"];
    delete rolled["30702"];

    // CAPTURE ORIGINAL EQUITY BEFORE RESULT
    // IMPORTANT:
    // We must ONLY sum POSTABLE ROOT EQUITY accounts.
    //
    // Example:
    // 302 = 3,200
    // 307 = current year earnings
    //
    // We must NOT include:
    // - group 3 itself
    // - children already rolled into 302
    // - result hierarchy 307xx
    // - duplicated hierarchy balances

    const patrimonioOriginal = Object.entries(rolled)
      .filter(([code]) => {

        // only equity accounts
        if (!code.startsWith("3")) {
          return false;
        }

        // exclude root
        if (code === "3") {
          return false;
        }

        // exclude resultado hierarchy
        if (
          code === "307" ||
          code === "30701" ||
          code === "30702"
        ) {
          return false;
        }

        // IMPORTANT:
        // ONLY FIRST LEVEL EQUITY ACCOUNTS
        //
        // 302 ✅
        // 303 ✅
        // 30201 ❌
        // 3020101 ❌

        return code.length === 3;

      })
      .reduce((sum, [, acc]) => {

        return (
          sum + Math.abs(safe(acc.saldo))
        );

      }, 0);

    // RESULTADO DEL EJERCICIO
    if (resultado !== 0) {
      const resultCode = resultado >= 0 ? "30701" : "30702";
      // LEAF RESULT ACCOUNT
      rolled[resultCode] = {
        account_code: resultCode,
        initial: 0,
        debit: resultado < 0 ? Math.abs(resultado) : 0,
        credit: resultado > 0 ? resultado : 0,
        saldo: resultado,
      };
      // PARENT 307
      rolled["307"] = {
        account_code: "307",
        initial: 0,
        debit: resultado < 0 ? Math.abs(resultado) : 0,
        credit: resultado > 0 ? resultado : 0,
        saldo: resultado,
      };
      // FINAL GROUP 3
      // IMPORTANT:
      // Patrimonio final must equal:
      //
      // Initial / shareholder equity
      // + current year earnings
      //
      // Example:
      // 3,200 + 650.75 = 3,850.75

      const patrimonioFinal = round2(
        Math.abs(patrimonioOriginal) + resultado
      );

      rolled["3"] = {
        account_code: "3",

        initial: safe(rolled["3"]?.initial),

        debit:
          resultado < 0
            ? Math.abs(resultado)
            : 0,

        credit:
          resultado > 0
            ? resultado
            : 0,

        saldo: patrimonioFinal,
      };
    }

    console.log("[BALANCE DEBUG FINAL]", {
      patrimonioOriginal,
      resultado,
      patrimonioFinal: rolled["3"]?.saldo,
      activos: rolled["1"]?.saldo,
      pasivos: rolled["2"]?.saldo,
      expectedPatrimonio:
        Math.abs(patrimonioOriginal) + resultado,
    });

    // BUILD TABLE ROWS
    const rows: Row[] = Object.entries(rolled)
      .filter(([code]) => isBalanceAccount(code))
      .map(([code, acc]) => ({
        code,
        name: coaByCode.get(code) || "CUENTA NO DEFINIDA EN PUC",
        initialBalance: round2(
          normalizeBalance(code, safe(acc.initial))
        ),
        debit: round2(safe(acc.debit)),
        credit: round2(safe(acc.credit)),
        balance: round2(
          normalizeBalance(code, safe(acc.saldo))
        ),
        level: detectLevel(code),
      }))
      .filter((r) => r.level <= level)
      .sort((a, b) => a.code.localeCompare(b.code, "es"));

    return rows;
  }, [filteredEntries, resultado, level]);

  /* ------------------------------------------------------------------------ */
  /* VALIDATION                                                               */
  /* ------------------------------------------------------------------------ */

  const checkBalance = useMemo(() => {
    const get = (code: string) =>
      groupedAccounts.find((a) => a.code === code)?.balance || 0;
    const activos = safe(get("1"));
    const pasivos = safe(get("2"));
    const patrimonio = safe(get("3"));
    const diferencia = activos - (pasivos + patrimonio);
    return {
      activos,
      pasivos,
      patrimonio,
      diferencia,
      cuadrado: Math.abs(diferencia) < 0.01,
    };
  }, [groupedAccounts]);

  /* ------------------------------------------------------------------------ */
  /* EXPORT PDF                                                               */
  /* ------------------------------------------------------------------------ */

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Balance General", 14, 14);
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

  /* ------------------------------------------------------------------------ */
  /* EXPORT CSV                                                               */
  /* ------------------------------------------------------------------------ */

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
  /* UI                                                                       */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="w-full">
      {showHeader && (
        <div className="flex items-center justify-between mb-3">
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
          ⚠️ Balance no cuadra:{" "}
          Activo ≠ Pasivo + Patrimonio
          <div className="mt-2 text-xs space-y-1">
            <div>
              Activos: {formatAmount(checkBalance.activos)}
            </div>
            <div>
              Pasivos: {formatAmount(checkBalance.pasivos)}
            </div>
            <div>
              Patrimonio: {formatAmount(checkBalance.patrimonio)}
            </div>
            <div className="font-semibold pt-1">
              Diferencia: {formatAmount(checkBalance.diferencia)}
            </div>
          </div>
        </div>
      )}
      <table className="min-w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c}
                className="px-3 py-2 text-left"
              >
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