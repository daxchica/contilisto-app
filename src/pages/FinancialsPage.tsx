// src/pages/FinancialsPage.tsx

import React, { useMemo } from "react";
import PnLSummary from "../components/PnLSummary";
import { BalanceSheetDisplay } from "../components/BalanceSheetDisplay";
import { JournalEntry } from "../types/JournalEntry";

interface Props {
  entries: JournalEntry[];
}

export default function FinancialsPage({ entries }: Props) {
  const resultadoDelEjercicio = useMemo(() => {
    const sumByCode = (codes: string[], side: "debit" | "credit") =>
      entries
        .filter((e) => codes.includes(e.account_code || ""))
        .reduce((acc, e) => acc + Number(e[side] || 0), 0);

    const sumByPrefix = (prefix: string, side: "debit" | "credit") =>
      entries
        .filter((e) => (e.account_code || "").startsWith(prefix))
        .reduce((acc, e) => acc + Number(e[side] || 0), 0);

    const ventas = sumByCode(["70101"], "credit");
    const compras = sumByCode(["60601"], "debit");
    const ice = sumByCode(["53901"], "debit");
    const ivaCredito = sumByCode(["24301"], "debit");
    const costoVentas = compras + ice + ivaCredito;
    const gastos = sumByPrefix("5", "debit");

    const utilidadBruta = ventas - costoVentas;
    const utilidadNeta = utilidadBruta - gastos;

    return utilidadNeta;
  }, [entries]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <h2 className="text-lg font-bold">Estado de Resultados</h2>
        <PnLSummary entries={entries} result={resultadoDelEjercicio} />
      </div>
      <div>
        <h2 className="text-lg font-bold">Balance General</h2>
        <BalanceSheetDisplay entries={entries} result={resultadoDelEjercicio} />
      </div>
    </div>
  );
}