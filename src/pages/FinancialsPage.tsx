// src/pages/FinancialsPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import PnLSummary from "../components/PnLSummary";
import BalanceSheet from "../components/BalanceSheet";

import { fetchJournalEntries } from "../services/journalService";
import { fetchInitialBalances } from "@/services/initialBalanceService";
import { initialBalancesToJournalEntries } from "@/services/initialBalanceAdapter";

import { useSelectedEntity } from "../context/SelectedEntityContext";
import type { JournalEntry } from "../types/JournalEntry";

export default function FinancialsPage() {
  const { selectedEntity } = useSelectedEntity(); // ← Empresa seleccionada globalmente

  const entityId = selectedEntity?.id ?? "";
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [initialEntries, setInitialEntries] = useState<JournalEntry[]>([]);
  const [resultadoDelEjercicio, setResultadoDelEjercicio] = useState(0);
  const [startDate, setStartDate] = useState("2025-01-01");
  const [endDate, setEndDate] = useState("2025-12-31");
  
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

  /* --------------------- Load Initial Balances --------------------- */
  useEffect(() => {
    if (!entityId) {
      setInitialEntries([]);
      return;
    }

  (async () => {
    try {
      const balances = await fetchInitialBalances(entityId);
      const adapted = initialBalancesToJournalEntries(balances, entityId);
      setInitialEntries(adapted);
    } catch (err) {
      console.error("Error loading initial balances:", err);
      setInitialEntries([]);
    }
  })();
}, [entityId]);

  /* --------------------- Merge for Balance Sheet --------------------- */
  const allEntries = useMemo(
    () => [...initialEntries, ...entries],
    [initialEntries, entries]
  );

  /* ----------------- Fallback: calculate base utility ----------------- */
  const utilidadBase = useMemo(() => {

    const ingresos = entries
      .filter((e) =>
        (e.account_code || "").startsWith("4")
      )
      .reduce(
        (acc, e) =>
          acc +
          Number(e.credit || 0) -
          Number(e.debit || 0),
        0
      );

    const costos = entries
      .filter((e) =>
        (e.account_code || "").startsWith("6")
      )
      .reduce(
        (acc, e) =>
          acc +
          Number(e.debit || 0) -
          Number(e.credit || 0),
        0
      );

    const gastos = entries
      .filter((e) =>
        (e.account_code || "").startsWith("5")
      )
      .reduce(
        (acc, e) =>
          acc +
          Number(e.debit || 0) -
          Number(e.credit || 0),
        0
      );

    return ingresos - costos - gastos;

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
        <PnLSummary 
          entries={entries} 
          startDate={startDate}
          endDate={endDate}
          onResultChange={handleResultChange} 
        />
      </div>

      {/* Balance General */}
      <div className="bg-white rounded shadow p-4">
        <h2 className="text-lg font-bold text-blue-800 mb-2">
          Balance General
        </h2>
        <BalanceSheet
          entries={allEntries}
          resultadoDelEjercicio={resultadoDelEjercicio}
          entityId={entityId}
        />
      </div>
    </div>
  );
}