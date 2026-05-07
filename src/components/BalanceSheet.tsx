// ============================================================================
// src/components/BalanceSheet.tsx
// CONTILISTO — Balance General
// Ecuador PUC compatible
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

const round2 = (n: number) => Number((n || 0).toFixed(2));

const isBalanceAccount = (code: string) =>
  ["1", "2", "3"].includes(code.charAt(0));

function normalizeBalance(code: string, saldo: number): number {
  // Activo: debit-normal → positive
  if (code.charAt(0) === "1") return saldo;
  // Pasivo / Patrimonio: credit-normal → show as positive
  return Math.abs(saldo);
}

// Indent pixels by level (used in inline style)
const INDENT: Record<number, string> = {
  1: "0px",
  2: "12px",
  3: "24px",
  4: "36px",
  5: "44px",
  6: "52px",
};

/* -------------------------------------------------------------------------- */
/* SECTION COMPONENT                                                          */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  rows,
  totalLabel,
  totalValue,
  accentClass,
}: {
  title: string;
  rows: Row[];
  totalLabel: string;
  totalValue: number;
  accentClass: string;
}) {
  return (
    <div className="mb-6">
      {/* Section header */}
      <div className={`px-3 py-2 rounded-t-lg font-bold text-sm uppercase tracking-wide ${accentClass}`}>
        {title}
      </div>

      <div className="border border-t-0 rounded-b-lg overflow-hidden">
        {rows.map((row) => {
          const isGroup = row.level <= 2;
          const indent = INDENT[row.level] ?? "52px";
          const showValue = row.balance !== 0;

          return (
            <div
              key={row.code}
              className={`flex items-baseline justify-between px-3 py-1.5 border-b last:border-b-0 ${
                isGroup
                  ? "bg-gray-50 font-semibold text-gray-800"
                  : "bg-white text-gray-700"
              }`}
            >
              <div className="flex items-baseline gap-2 min-w-0" style={{ paddingLeft: indent }}>
                <span className={`shrink-0 font-mono text-xs ${isGroup ? "text-gray-500" : "text-gray-400"}`}>
                  {row.code}
                </span>
                <span className="truncate text-sm">{row.name}</span>
              </div>
              <span className={`ml-4 shrink-0 text-sm text-right tabular-nums ${
                isGroup ? "font-semibold" : ""
              } ${showValue ? "" : "text-gray-300"}`}>
                {showValue ? formatAmount(row.balance) : "—"}
              </span>
            </div>
          );
        })}

        {/* Section total */}
        <div className={`flex justify-between px-3 py-2 font-bold text-sm border-t-2 ${accentClass}`}>
          <span>{totalLabel}</span>
          <span className="tabular-nums">{formatAmount(totalValue)}</span>
        </div>
      </div>
    </div>
  );
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
  const [level, setLevel] = useState(3);

  /* ------------------------------------------------------------------------ */
  /* FILTER TO ENTITY + BALANCE ACCOUNTS                                     */
  /* ------------------------------------------------------------------------ */

  const filteredEntries = useMemo(() =>
    entries.filter((e) => {
      if (!e?.account_code?.trim()) return false;
      if (!e.entityId) return false;
      if (entityId && e.entityId !== entityId) return false;
      return true;
    }),
    [entries, entityId]
  );

  /* ------------------------------------------------------------------------ */
  /* RESULTADO DEL EJERCICIO (computed from P&L accounts)                   */
  /* ------------------------------------------------------------------------ */

  const resultadoReal = useMemo(() => {
    const pnl = filteredEntries.filter(
      (e) => e.source !== "initial" && ["4", "5", "6"].includes((e.account_code || "").charAt(0))
    );
    const ingresos = pnl
      .filter((e) => e.account_code?.startsWith("4"))
      .reduce((s, e) => s + safe(e.credit) - safe(e.debit), 0);
    const costos = pnl
      .filter((e) => e.account_code?.startsWith("6"))
      .reduce((s, e) => s + safe(e.debit) - safe(e.credit), 0);
    const gastos = pnl
      .filter((e) => e.account_code?.startsWith("5"))
      .reduce((s, e) => s + safe(e.debit) - safe(e.credit), 0);
    return round2(ingresos - costos - gastos);
  }, [filteredEntries]);

  const resultado = resultadoReal !== 0 ? resultadoReal : safe(resultadoDelEjercicio);

  /* ------------------------------------------------------------------------ */
  /* BUILD ROLLED-UP ACCOUNTS                                                 */
  /* ------------------------------------------------------------------------ */

  const { activoRows, pasivoRows, patrimonioRows, checkBalance } = useMemo(() => {
    const coaByCode = new Map<string, string>(
      ECUADOR_COA.map((a: any) => [String(a.code), String(a.name)])
    );

    const balanceEntries = filteredEntries.filter((e) =>
      ["1", "2", "3"].includes((e.account_code || "").charAt(0))
    );

    const grouped = groupEntriesByAccount(balanceEntries);
    const rolled = rollupAccounts(grouped);

    // Remove auto-generated result hierarchy before we inject it properly
    delete rolled["307"];
    delete rolled["30701"];
    delete rolled["30702"];

    // Patrimonio original (only level-2 equity accounts, excluding 307)
    const patrimonioOriginal = Object.entries(rolled)
      .filter(([code]) =>
        code.startsWith("3") &&
        code !== "3" &&
        code.length === 3 &&
        code !== "307"
      )
      .reduce((sum, [, acc]) => sum + Math.abs(safe(acc.saldo)), 0);

    // Inject resultado
    if (resultado !== 0) {
      const resultCode = resultado >= 0 ? "30701" : "30702";
      rolled[resultCode] = {
        account_code: resultCode,
        initial: 0,
        debit: resultado < 0 ? Math.abs(resultado) : 0,
        credit: resultado > 0 ? resultado : 0,
        saldo: resultado,
      };
      rolled["307"] = {
        account_code: "307",
        initial: 0,
        debit: resultado < 0 ? Math.abs(resultado) : 0,
        credit: resultado > 0 ? resultado : 0,
        saldo: resultado,
      };
      const patrimonioFinal = round2(Math.abs(patrimonioOriginal) + resultado);
      rolled["3"] = {
        account_code: "3",
        initial: safe(rolled["3"]?.initial),
        debit: resultado < 0 ? Math.abs(resultado) : 0,
        credit: resultado > 0 ? resultado : 0,
        saldo: patrimonioFinal,
      };
    }

    // Build typed rows
    const toRows = (prefix: string): Row[] =>
      Object.entries(rolled)
        .filter(([code]) => code.startsWith(prefix) && isBalanceAccount(code))
        .map(([code, acc]) => ({
          code,
          name: coaByCode.get(code) || acc.account_code,
          balance: round2(normalizeBalance(code, safe(acc.saldo))),
          level: detectLevel(code),
        }))
        .filter((r) => r.level <= level)
        .sort((a, b) => a.code.localeCompare(b.code, "es"));

    const activoRows   = toRows("1");
    const pasivoRows   = toRows("2");
    const patrimonioRows = toRows("3");

    const get = (rows: Row[], code: string) =>
      rows.find((r) => r.code === code)?.balance ?? 0;

    const activos    = get(activoRows, "1");
    const pasivos    = get(pasivoRows, "2");
    const patrimonio = get(patrimonioRows, "3");
    const diferencia = round2(activos - (pasivos + patrimonio));

    return {
      activoRows,
      pasivoRows,
      patrimonioRows,
      checkBalance: { activos, pasivos, patrimonio, diferencia, cuadrado: Math.abs(diferencia) < 0.02 },
    };
  }, [filteredEntries, resultado, level]);

  /* ------------------------------------------------------------------------ */
  /* EXPORT PDF                                                               */
  /* ------------------------------------------------------------------------ */

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Balance General", 14, 14);
    const allRows = [...activoRows, ...pasivoRows, ...patrimonioRows];
    autoTable(doc, {
      startY: 20,
      head: [["Código", "Cuenta", "Saldo"]],
      body: allRows.map((r) => [r.code, r.name, r.balance.toFixed(2)]),
    });
    doc.save("balance-general.pdf");
  };

  /* ------------------------------------------------------------------------ */
  /* EXPORT CSV                                                               */
  /* ------------------------------------------------------------------------ */

  const exportCSV = () => {
    const allRows = [...activoRows, ...pasivoRows, ...patrimonioRows];
    const csv = Papa.unparse({
      fields: ["Código", "Cuenta", "Saldo"],
      data: allRows.map((r) => [r.code, r.name.replace(/ /g, " "), r.balance.toFixed(2)]),
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "balance-general.csv";
    a.click();
  };

  /* ------------------------------------------------------------------------ */
  /* TOTALS                                                                   */
  /* ------------------------------------------------------------------------ */

  const totalActivo     = checkBalance.activos;
  const totalPasivo     = checkBalance.pasivos;
  const totalPatrimonio = checkBalance.patrimonio;
  const totalPasivoPatrimonio = round2(totalPasivo + totalPatrimonio);

  /* ------------------------------------------------------------------------ */
  /* UI                                                                       */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="w-full">

      {/* TOOLBAR */}
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-lg font-bold text-blue-800">📘 Balance General</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-gray-600 flex items-center gap-1">
              Nivel:
              <select
                className="ml-1 border rounded px-2 py-1 text-sm"
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <button
              onClick={exportPDF}
              className="px-3 py-1.5 text-sm bg-blue-700 text-white rounded"
            >
              PDF
            </button>
            <button
              onClick={exportCSV}
              className="px-3 py-1.5 text-sm bg-emerald-700 text-white rounded"
            >
              CSV
            </button>
          </div>
        </div>
      )}

      {/* BALANCE CHECK WARNING */}
      {!checkBalance.cuadrado && (
        <div className="mb-4 p-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg">
          <p className="font-semibold">⚠️ Balance no cuadra — Activo ≠ Pasivo + Patrimonio</p>
          <div className="mt-1 space-y-0.5 text-xs">
            <p>Activo: {formatAmount(checkBalance.activos)}</p>
            <p>Pasivo: {formatAmount(checkBalance.pasivos)}</p>
            <p>Patrimonio: {formatAmount(checkBalance.patrimonio)}</p>
            <p className="font-semibold pt-1">Diferencia: {formatAmount(checkBalance.diferencia)}</p>
          </div>
        </div>
      )}

      {/* ACTIVO */}
      <Section
        title="Activo"
        rows={activoRows.filter((r) => r.code !== "1")}
        totalLabel="Total Activo"
        totalValue={totalActivo}
        accentClass="bg-blue-700 text-white"
      />

      {/* PASIVO */}
      <Section
        title="Pasivo"
        rows={pasivoRows.filter((r) => r.code !== "2")}
        totalLabel="Total Pasivo"
        totalValue={totalPasivo}
        accentClass="bg-red-700 text-white"
      />

      {/* PATRIMONIO */}
      <Section
        title="Patrimonio"
        rows={patrimonioRows.filter((r) => r.code !== "3")}
        totalLabel="Total Patrimonio"
        totalValue={totalPatrimonio}
        accentClass="bg-green-700 text-white"
      />

      {/* GRAND TOTAL EQUATION */}
      <div className={`rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold ${
        checkBalance.cuadrado
          ? "bg-blue-50 border border-blue-200 text-blue-800"
          : "bg-red-50 border border-red-200 text-red-800"
      }`}>
        <span>
          {checkBalance.cuadrado ? "✅" : "❌"} Total Pasivo + Patrimonio
        </span>
        <div className="flex items-center gap-4 tabular-nums">
          <span className="text-gray-500 font-normal text-xs">
            Activo: {formatAmount(totalActivo)}
          </span>
          <span className="text-base">
            {formatAmount(totalPasivoPatrimonio)}
          </span>
        </div>
      </div>

    </div>
  );
}
