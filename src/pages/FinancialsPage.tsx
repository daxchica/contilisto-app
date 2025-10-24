// src/pages/FinancialsPage.tsx

import React, { useState, useMemo, useCallback } from "react";
import PnLSummary from "../components/PnLSummary";
import BalanceSheet from "../components/BalanceSheet";
import { JournalEntry } from "../types/JournalEntry";

interface Props {
  entries: JournalEntry[];
  entityId: string;
}

export default function FinancialsPage({ entries, entityId }: Props) {
  // ✅ Controlamos el resultado contable desde aquí
  const [resultadoDelEjercicio, setResultadoDelEjercicio] = useState<number>(0);

  // ✅ Calcular el resultado base (útil si el componente se recarga sin PnLSummary)
  const utilidadBase = useMemo(() => {
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

  // ✅ Callback que recibe el resultado desde PnLSummary
  const handleResultChange = useCallback((newResult: number) => {
    setResultadoDelEjercicio(newResult);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      {/* Estado de Resultados */}
      <div className="bg-white rounded shadow p-4">
        <h2 className="text-lg font-bold text-blue-800 mb-2">
          Estado de Resultados
        </h2>
        <PnLSummary entries={entries} onResultChange={handleResultChange} />
      </div>

      {/* Balance General */}
      <div className="bg-white rounded shadow p-4">
        <h2 className="text-lg font-bold text-blue-800 mb-2">Balance General</h2>
        <BalanceSheet entries={entries} resultadoDelEjercicio={resultadoDelEjercicio} entityId={entityId} />
      </div>
    </div>
  );
}