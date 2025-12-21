// src/pages/FinancialStatements.tsx
import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useSelectedEntity } from "../context/SelectedEntityContext";

import PnLSummary from "../components/PnLSummary";
import BalanceSheet from "../components/BalanceSheet";
import InitialBalancePanel from "../components/InitialBalancePanel";
import TrialBalance from "../components/TrialBalance";
import { fetchJournalEntries } from "@/services/journalService";

import { JournalEntry } from "../types/JournalEntry";
import ECUADOR_COA from "@/../shared/coa/ecuador_coa";

type Tab = "comprobacion" | "estado" | "balance";

export default function FinancialStatements() {
  // -------------------------------------------
  // Selected entity context
  // -------------------------------------------
  const { selectedEntity } = useSelectedEntity();
  const entityId = selectedEntity?.id ?? "";
  const entityName = selectedEntity?.name ?? "";
  const entityRuc = selectedEntity?.ruc ?? "";

  // -------------------------------------------
  // Journal entries
  // -------------------------------------------
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // -------------------------------------------
  // Tabs — Option B (browser-style)
  // -------------------------------------------
  const [activeTab, setActiveTab] = useState<Tab>("comprobacion");

  // -------------------------------------------
  // Date filters PER REPORT (Option B)
  // -------------------------------------------
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // ------------------------------------
  // Load entries (currently disabled)
  // ------------------------------------
  useEffect(() => {
    if (!entityId) {
      setEntries([]);
      return;
    }
    setLoading(true);

    fetchJournalEntries(entityId)
      .then((data) => {
        console.log("Loaded journal entries:", data);
        setEntries(data);
      })
      .catch((err) => {
        console.error("Error loading journal entries:", err);
        setEntries([]);
      })
      .finally(() => {
        setLoading(false);
    });
  }, [entityId]);

  // ------------------------------------
  // Helper: returns filtered entries for a tab
  // ------------------------------------
  const filteredEntries = useMemo(() => {
    if (!startDate && !endDate) return entries;
    
    const from = startDate ? new Date(startDate) : null;
    const to   = endDate ? new Date(endDate)   : null;

    return entries.filter((e) => {
      
      if (!e.date) return false;
      const d = new Date(e.date);

      if (from && d < from) return false;
      if (to && d > to) return false;
      
      return true;
    });
  }, [entries, startDate, endDate]);

  // -------------------------------------------
  // Calculate the PnL result (needed for Balance Sheet)
  // -------------------------------------------
  const resultadoDelEjercicio = useMemo(() => {
  const sumByPrefix = (prefix: string, side: "debit" | "credit") =>
    filteredEntries
      .filter((e) => (e.account_code || "").startsWith(prefix))
      .reduce((acc, e) => acc + Number(e[side] || 0), 0);

  const ventas = sumByPrefix("7", "credit");
  const gastos = sumByPrefix("5", "debit");
  return ventas - gastos;
}, [filteredEntries]);

  // ------------------------------------
  // Render the selected tab content
  // ------------------------------------
  const renderReport = () => {
    if (loading) return <p className="text-blue-600 animate-pulse">⏳ Cargando registros contables...</p>;
    if (!filteredEntries.length) 
      return <p className="text-gray-500 italic">No hay registros en el rango seleccionado.</p>;

    if (activeTab === "comprobacion") 
      return <TrialBalance entries={filteredEntries} />;

    if (activeTab === "estado")
      return <PnLSummary entries={filteredEntries} />;

    if (activeTab === "balance") 
        return (
          <BalanceSheet 
            entries={filteredEntries} 
            resultadoDelEjercicio={resultadoDelEjercicio} 
            entityId={entityId}
            startDate={startDate}
            endDate={endDate}
          />
        );
        return null; 
  };

  // ------------------------------------
  // If no entity is selected
  // ------------------------------------
  if (!entityId) {
    return (
      <div className="pt-24 px-6 min-h-screen">
        
          <h1 className="text-2xl font-bold text-blue-700 mb-4">📊 Estados Financieros</h1>
          <p className="mb-4">
            Debes seleccionar una entidad primero en el{" "}
            <Link className="text-blue-600 underline" to="/dashboard">Tablero de Entidades</Link>.
          </p>
        </div>
      
    );
  }

  // ------------------------------------
  // RENDER
  // ------------------------------------
  return (
      <div className="pt-16 px-4 lg:px-6 min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-7xl">

          {/* PAGE TITLE */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-blue-700">📊 Estados Financieros</h1>
            <p className="text-sm text-gray-600">
              Empresa: <strong>{entityRuc}</strong> — {entityName}
            </p>
          </div>

          {/* INITIAL BALANCE PANEL */}
          <div className="mb-6">
            <InitialBalancePanel 
              entityId={entityId} 
              userId={"initial-balance"}
              accounts={ECUADOR_COA}
            />
          </div>

          {/* BROWSER STYLE TABS */}
          <div className="flex justify-center gap-2 border-b mb-4">
            {[
              { id: "comprobacion", label: "Balance de Comprobación" },
              { id: "estado", label: "Estado de Resultados" },
              { id: "balance", label: "Balance General" }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as Tab)}
                className={`
                  px-4 py-2 rounded-t-md
                  ${activeTab === t.id
                    ? "bg-white border border-b-0 text-blue-700 font-semibold"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"}
                `}
              >
                {t.label}
              </button>
            ))}
          </div>

           {/* DATE FILTER FOR ACTIVE TAB */}
        <div className="bg-white border rounded-lg shadow-sm p-4 mb-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">

            {/* From Date */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Desde</label>
              <input
                type="date"
                className="border rounded px-2 py-1 text-sm"
                value={startDate}
                onChange={(e) =>
                  setStartDate(e.target.value)}
              />
            </div>

            {/* Unitl Date */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Hasta</label>
              <input
                type="date"
                className="border rounded px-2 py-1 text-sm"
                value={endDate}
                onChange={(e) =>
                  setEndDate(e.target.value)}
              />
            </div>

          {/* Clear */}
            {(startDate || endDate) && (
              <button
                className="text-sm text-blue-700 underline"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
              >
                Limpiar rango
              </button>
            )}
          </div>
        </div>

        {/* Report Content */}
        <div className="bg-white shadow rounded-lg p-4 lg:p-6 mb-12">
          {renderReport()}
        </div>
      </div>
    </div>
  );
}