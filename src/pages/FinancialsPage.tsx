// src/pages/FinancialsPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import PnLSummary from "../components/PnLSummary";
import BalanceSheet from "../components/BalanceSheet";

import { fetchJournalEntries } from "../services/journalService";
import type { JournalEntry } from "../types/JournalEntry";
import { useSelectedEntity } from "../context/SelectedEntityContext";

export default function FinancialsPage() {
  const { selectedEntity } = useSelectedEntity(); // ← Empresa seleccionada globalmente

  const entityId = selectedEntity?.id ?? "";
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [resultadoDelEjercicio, setResultadoDelEjercicio] = useState(0);

  /* ----------------------- Load Journal Entries ----------------------- */
  useEffect(() => {
    if (!entityId) {
      setEntries([]);
      return;
    }

    (async () => {
      try {
        const data = await fetchJournalEntries(entityId);
        setEntries(data);
      } catch (err) {
        console.error("Error loading journal entries:", err);
        setEntries([]);
      }
    })();
  }, [entityId]);

  /* ----------------- Fallback: calculate base utility ----------------- */
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

    return ventas - costoVentas - gastos;
  }, [entries]);

  const handleResultChange = useCallback((newResult: number) => {
    setResultadoDelEjercicio(newResult);
  }, []);

  /* ----------------------------- UI ----------------------------- */
  if (!entityId) {
    return (
      <div className="p-6 pt-20 text-center">
        <h2 className="text-xl font-bold text-gray-600">
          Debes seleccionar una empresa
        </h2>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 pt-20">
      {/* Estado de Resultados */}
      <div className="bg-white rounded shadow p-4">
        <h2 className="text-lg font-bold text-blue-800 mb-2">
          Estado de Resultados
        </h2>
        <PnLSummary entries={entries} onResultChange={handleResultChange} />
      </div>

      {/* Balance General */}
      <div className="bg-white rounded shadow p-4">
        <h2 className="text-lg font-bold text-blue-800 mb-2">
          Balance General
        </h2>
        <BalanceSheet
          entries={entries}
          resultadoDelEjercicio={resultadoDelEjercicio || utilidadBase}
          entityId={entityId}
        />
      </div>
    </div>
  );
}