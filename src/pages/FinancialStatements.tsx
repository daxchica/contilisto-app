""// src/pages/FinancialStatements.tsx

import React, { useEffect, useState } from "react";
import PnLSummary from "../components/PnLSummary";
import BalanceSheet from "../components/BalanceSheet";
import { getEntities, deleteEntity } from "../services/entityService";
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

  const [entityToDelete, setEntityToDelete] = useState<Entity | null>(null);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!currentUser?.uid) return;

    getEntities(currentUser.uid)
      .then((data) => {
        setEntities(data);
        if (data.length > 0) setSelectedEntity(data[0]);
      })
      .catch(console.error);
  }, [currentUser]);

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

  const handleDeleteClick = (entity: Entity) => {
    setEntityToDelete(entity);
    setConfirmText("");
  };

  const confirmDelete = async () => {
    if (!entityToDelete || confirmText !== entityToDelete.name) return;

    try {
      await deleteEntity(entityToDelete.id);
      const updatedEntities = entities.filter(e => e.id !== entityToDelete.id);
      setEntities(updatedEntities);
      if (selectedEntity?.id === entityToDelete.id) {
        setSelectedEntity(null);
        setEntries([]);
      }
      setEntityToDelete(null);
      setConfirmText("");
      alert("Entidad eliminada con éxito.");
    } catch (error) {
      console.error("❌ Error al eliminar entidad:", error);
      alert("No se pudo eliminar la entidad.");
    }
  };

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
        <div className="flex gap-2 items-center">
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
{/*}
          {selectedEntity && (
            <button
              className="px-2 py-1 text-sm text-red-600 border border-red-500 rounded hover:bg-red-100"
              onClick={() => handleDeleteClick(selectedEntity)}
            >
              🗑 Eliminar
            </button>
          )}*/}
        </div> 
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

      {/* Delete Confirmation Modal */}
      {entityToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h2 className="text-lg font-bold mb-4 text-red-700">Confirmar eliminación</h2>
            <p className="mb-2">
              Escribe el nombre exacto de la empresa <strong>{entityToDelete.name}</strong> para confirmar.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full border px-2 py-1 rounded mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
                onClick={() => setEntityToDelete(null)}
              >
                Cancelar
              </button>
              <button
                disabled={confirmText !== entityToDelete.name}
                className={`px-3 py-1 rounded ${
                  confirmText === entityToDelete.name
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-red-200 text-gray-500 cursor-not-allowed"
                }`}
                onClick={confirmDelete}
              >
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
