// src/pages/FinancialStatements.tsx

import React, { useEffect, useState } from "react";
import PnLSummary from "../components/PnLSummary";
import BalanceSheet from "../components/BalanceSheet";
import { getEntities } from "../services/entityService";
import { fetchJournalEntries } from "../services/journalService";
import { JournalEntry } from "../types/JournalEntry";
import { getAuth } from "firebase/auth";

interface Entity {
  id: string;
  ruc: string;
  name: string;
}

export default function FinancialStatements() {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"estado" | "balance">("estado");

  // Load user's entities
  useEffect(() => {
    if (!currentUser?.uid) return;

    getEntities(currentUser.uid)
      .then((data) => {
        setEntities(data);
        if (data.length > 0) setSelectedEntity(data[0]);
      })
      .catch(console.error);
  }, [currentUser]);

  // Load journal entries when entity changes
  useEffect(() => {
    if (!selectedEntity) return;

    setLoading(true);
    fetchJournalEntries(selectedEntity.id)
      .then(setEntries)
      .catch((err) => {
        console.error("Error loading journal entries:", err);
        setEntries([]);
      })
      .finally(() => setLoading(false));
  }, [selectedEntity]);

  const renderContent = () => {
    if (loading) {
      return (
        <p className="text-blue-600 animate-pulse">
          ⏳ Cargando registros contables...
        </p>
      );
    }

    if (!entries.length) {
      return (
        <p className="text-gray-500 italic">
          No hay registros contables para esta entidad.
        </p>
      );
    }

    if (activeTab === "estado") {
      return <PnLSummary entries={entries} />;
    }

    if (activeTab === "balance") {
      return <BalanceSheet entries={entries} />;
    }

    return null;
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-blue-700 mb-6">
        📊 Estados Financieros
      </h1>

      {/* Entity Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Selecciona una entidad
        </label>
        <select
          value={selectedEntity?.ruc || ""}
          onChange={(e) =>
            setSelectedEntity(
              entities.find((ent) => ent.ruc === e.target.value) || null
            )
          }
          className="p-2 border rounded w-full max-w-md"
        >
          {entities.map((entity) => (
            <option key={entity.id} value={entity.ruc}>
              {entity.ruc} – {entity.name}
            </option>
          ))}
        </select>
      </div>

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
