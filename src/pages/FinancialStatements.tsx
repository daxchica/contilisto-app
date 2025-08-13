""// src/pages/FinancialStatements.tsx

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useSelectedEntity } from "../context/SelectedEntityContext";

import PnLSummary from "../components/PnLSummary";
import BalanceSheet from "../components/BalanceSheet";
import InitialBalancePanel from "../components/InitialBalancePanel";

import { fetchJournalEntries } from "../services/journalService";
import { JournalEntry } from "../types/JournalEntry";

type Tab = "estado" | "balance";

export default function FinancialStatements() {
  const { entity } = useSelectedEntity();
  const entityId = entity?.id ?? "";
  const entityName = useMemo(() => entity?.name ?? "", [entity?.name]);
  const entityRuc = useMemo(() => entity?.ruc ?? "", [entity?.ruc]);

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("estado");
  
 // Load journal entries for the selected entity
  useEffect(() => {
    if (!entityId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    fetchJournalEntries(entityId)
      .then(setEntries)
      .catch((err) => {
        console.error("Error loading journal entries:", err);
        setEntries([]);
      })
      .finally(() => setLoading(false));
  }, [entityId]);

  const renderContent = () => {
    if (loading) {
      return <p className="text-blue-600 animate-pulse">⏳ Cargando registros contables...</p>
    }
    if (!entries.length) {
      return <p className="text-gray-500 italic">No hay registros contables para esta entidad.</p>
    }
    if (activeTab === "estado") return <PnLSummary entries={entries} />;
    if (activeTab === "balance") return <BalanceSheet entries={entries} />;
    return null;
  };

  // If user hasn’t selected an entity yet, guide them to the dashboard
  if (!entityId) {
    return (
      <div className="pt-20 p-8 bg-gray-50 min-h-screen">
        <h1 className="text-2xl font-bold text-blue-700 mb-4">📊 Estados Financieros</h1>
        <p className="mb-4">
          Debes seleccionar una entidad primero en el{" "}
          <Link className="text-blue-600 underline" to="/dashboard">Tablero de Entidades</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="pt-20 p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-blue-700 mb-6">📊 Estados Financieros</h1>
      <p className="text-l text-gray-600 mb-6">Entidad: <strong>{entityRuc}</strong> - {entityName}</p>

      {/* Si tu panel de saldos iniciales necesita el entityId, puedes pasarlo aquí */}
      <InitialBalancePanel entityId={entityId} />

      {/* Tabs */}
      <div className="flex space-x-4 border-b mb-6">
        {[
          { id: "estado", label: "Estado de Resultados" },
          { id: "balance", label: "Balance General" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as "estado" | "balance")}
            className={`pb-2 font-medium ${
              activeTab === tab.id
                ? "border-b-2 border-blue-700 text-blue-700"
                : "text-gray-500 hover:text-blue-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white shadow rounded p-6">{renderContent()}</div>

    </div>
  );
}
