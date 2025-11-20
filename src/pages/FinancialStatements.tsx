// src/pages/FinancialStatements.tsx
import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useSelectedEntity } from "../context/SelectedEntityContext";

import PnLSummary from "../components/PnLSummary";
import BalanceSheet from "../components/BalanceSheet";
import InitialBalancePanel from "../components/InitialBalancePanel";
import TrialBalance from "../components/TrialBalance";

// import { fetchJournalEntries } from "../services/journalService";
import { JournalEntry } from "../types/JournalEntry";

type Tab = "comprobacion" | "estado" | "balance";

export default function FinancialStatements() {
  const { entity } = useSelectedEntity();
  const entityId = entity?.id ?? "";
  const entityName = useMemo(() => entity?.name ?? "", [entity?.name]);
  const entityRuc   = useMemo(() => entity?.ruc  ?? "", [entity?.ruc]);

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("comprobacion");

  // filtros de fecha (globales)
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate]     = useState<string>("");

  useEffect(() => {
    if (!entityId) {
      setEntries([]);
      return;
    }
    setLoading(true);
//    fetchJournalEntries(entityId)
//      .then(setEntries)
//      .catch((err) => {
//        console.error("Error loading journal entries:", err);
//        setEntries([]);
//      })
//      .finally(() => setLoading(false));
  }, [entityId]);

  const filteredEntries = useMemo(() => {
    if (!startDate && !endDate) return entries;
    const from = startDate ? new Date(startDate) : null;
    const to   = endDate   ? new Date(endDate)   : null;
    return entries.filter((e) => {
      const d = e.date ? new Date(e.date) : null;
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [entries, startDate, endDate]);

  const resultadoDelEjercicio = useMemo(() => {
  const sumByPrefix = (prefix: string, side: "debit" | "credit") =>
    entries
      .filter((e) => (e.account_code || "").startsWith(prefix))
      .reduce((acc, e) => acc + Number(e[side] || 0), 0);

  const ventas = sumByPrefix("7", "credit");
  const gastos = sumByPrefix("5", "debit");
  const utilidadNeta = ventas - gastos;
  return utilidadNeta;
}, [entries]);

  const renderContent = () => {
    if (loading) return <p className="text-blue-600 animate-pulse">⏳ Cargando registros contables...</p>;
    if (!filteredEntries.length) return <p className="text-gray-500 italic">No hay registros en el rango seleccionado.</p>;

    if (activeTab === "comprobacion") return <TrialBalance entries={filteredEntries} />;
    if (activeTab === "estado")       return <PnLSummary   entries={filteredEntries} />;
    if (activeTab === "balance")      return <BalanceSheet entries={filteredEntries} resultadoDelEjercicio={resultadoDelEjercicio} entityId={entityId} />;

    return null;
  };

  if (!entityId) {
    return (
      <div className="pt-24 px-4 min-h-screen flex justify-center">
        <div className="w-full max-w-5xl">
          <h1 className="text-2xl font-bold text-blue-700 mb-4">📊 Estados Financieros</h1>
          <p className="mb-4">
            Debes seleccionar una entidad primero en el{" "}
            <Link className="text-blue-600 underline" to="/dashboard">Tablero de Entidades</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
      <div className="pt-24 px-4 min-h-screen flex justify-center">
        <div className="w-full max-w-5xl">
          <h1 className="text-2xl font-bold text-blue-700 mb-2 text-center">📊 Estados Financieros</h1>
          <p className="text-base text-gray-600 mb-8 text-center">
            Entidad: <strong>{entityRuc}</strong> — {entityName}
          </p>

          {/* Panel de Saldos Iniciales */}
          <div className="mb-8">
            <InitialBalancePanel entityId={entityId} userId="" accounts={[]}/>
          </div>

          {/* Filtros globales */}
          <div className="bg-white border rounded-lg shadow p-4 mb-6">
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
              <div className="flex items-center gap-2">
                <label htmlFor="fi" className="text-sm text-gray-700">Desde</label>
                <input
                  id="fi"
                  type="date"
                  className="border rounded px-2 py-1"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="ff" className="text-sm text-gray-700">Hasta</label>
                <input
                  id="ff"
                  type="date"
                  className="border rounded px-2 py-1"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              {(startDate || endDate) && (
                <button
                  className="text-sm text-blue-700 underline"
                  onClick={() => { setStartDate(""); setEndDate(""); }}
                >
                  Limpiar rango
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex justify-center gap-6 border-b mb-6">
            {[
              { id: "comprobacion", label: "Balance de Comprobación" },
              { id: "estado",       label: "Estado de Resultados" },
              { id: "balance",      label: "Balance General" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as Tab)}
                className={`pb-2 font-medium ${
                  activeTab === t.id
                    ? "border-b-2 border-blue-700 text-blue-700"
                    : "text-gray-500 hover:text-blue-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

        {/* Contenido */}
        <div className="bg-white shadow rounded p-6 mb-16">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}