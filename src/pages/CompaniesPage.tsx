// src/pages/CompaniesPage.tsx

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import type { Entity, EntityType } from "@/types/Entity";
import { useAuth } from "@/context/AuthContext";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import {
  fetchEntities,
  createEntity,
  deleteEntity,
} from "@/services/entityService";

import AddEntityModal from "@/components/modals/AddEntityModal";
import EditEntityModal from "@/components/entity/EditEntityModal";
import { initializeEntityCOA } from "@/services/coaService";
import { usePlan } from "@/hooks/usePlan";

type CreateEntityPayload = {
  ruc: string;
  name: string;
  entityType: EntityType;
  address?: string;
  phone?: string;
  email: string;
};

// ============================================================================
// ENTITY CARD
// ============================================================================

function EntityCard({
  entity,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  entity: Entity;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`relative rounded-xl border-2 p-4 cursor-pointer transition-all ${
        isSelected
          ? "border-blue-600 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
      }`}
    >
      {/* Selected badge */}
      {isSelected && (
        <span className="absolute top-3 right-3 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">
          Activa
        </span>
      )}

      {/* Name */}
      <p className="font-bold text-gray-900 text-base leading-tight pr-16 truncate">
        {entity.name}
      </p>

      {/* RUC */}
      <p className="text-xs font-mono text-gray-500 mt-0.5">{entity.ruc}</p>

      {/* Type badge + email */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
          {entity.type}
        </span>
        {entity.email && (
          <span className="text-xs text-gray-400 truncate">{entity.email}</span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2 border-t pt-3">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="flex-1 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
        >
          ✏️ Editar
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex-1 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
        >
          🗑 Eliminar
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function CompaniesPage() {
  const { user, loading } = useAuth();
  const { selectedEntity, setEntity } = useSelectedEntity();
  const { plan } = usePlan();
  const navigate = useNavigate();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atLimit = entities.length >= plan.limits.maxEntities;
  const usagePercent = Math.min(
    100,
    Math.round((entities.length / plan.limits.maxEntities) * 100)
  );

  /* -------------------------------------------------------------------------- */
  /* LOAD                                                                       */
  /* -------------------------------------------------------------------------- */

  const loadEntities = useCallback(async () => {
    try {
      setLoadingEntities(true);
      const data = await fetchEntities();
      setEntities(data);
    } catch (err) {
      console.error("FETCH ENTITIES ERROR", err);
    } finally {
      setLoadingEntities(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { setLoadingEntities(false); return; }
    loadEntities();
  }, [loading, user, loadEntities]);

  /* -------------------------------------------------------------------------- */
  /* DELETE                                                                     */
  /* -------------------------------------------------------------------------- */

  const handleDelete = async (entity: Entity) => {
    const confirmed = window.confirm(
      `¿Eliminar la empresa "${entity.name}"?\n\n⚠️ Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    try {
      setError(null);
      await deleteEntity(entity.id!);
      await loadEntities();
      if (selectedEntity?.id === entity.id) setEntity(null);
    } catch (err) {
      console.error("DELETE ENTITY ERROR", err);
      setError("No se pudo eliminar la empresa.");
    }
  };

  /* -------------------------------------------------------------------------- */
  /* CREATE                                                                     */
  /* -------------------------------------------------------------------------- */

  const handleCreateEntity = async (payload: CreateEntityPayload) => {
    if (creating) return;
    if (atLimit) {
      alert("Has alcanzado el límite de empresas de tu plan.");
      return;
    }

    setCreating(true);
    try {
      setError(null);

      const newEntityId = await createEntity({
        ruc: payload.ruc.trim(),
        name: payload.name.trim(),
        type: payload.entityType,
        address: payload.address,
        phone: payload.phone,
        email: payload.email,
      });

      try {
        await initializeEntityCOA(newEntityId);
      } catch (err) {
        console.error("COA INIT FAILED", err);
        alert("Empresa creada pero el plan de cuentas no se pudo inicializar.");
      }

      const data = await fetchEntities();
      setEntities(data);

      const created = data.find((e) => e.id === newEntityId);
      if (created) {
        setEntity(created);
        navigate("/dashboard");
      }

      setShowAddModal(false);
    } catch (err) {
      console.error("CREATE ENTITY ERROR", err);
      alert("❌ No se pudo crear la empresa.");
    } finally {
      setCreating(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* LOADING                                                                    */
  /* -------------------------------------------------------------------------- */

  if (loading || loadingEntities) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-gray-400 animate-pulse">Cargando empresas…</p>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* RENDER                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">

      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">🏢 Empresas Registradas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Selecciona una empresa para trabajar con ella
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          disabled={atLimit}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
            atLimit
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          ➕ Agregar empresa
        </button>
      </div>

      {/* PLAN USAGE BAR */}
      <div className="mb-6 bg-white border rounded-xl px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Uso del plan
          </span>
          <span className={`text-xs font-semibold ${atLimit ? "text-red-600" : "text-gray-600"}`}>
            {entities.length} / {plan.limits.maxEntities} empresas
          </span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              atLimit ? "bg-red-500" : usagePercent > 75 ? "bg-yellow-400" : "bg-blue-500"
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        {atLimit && (
          <p className="text-xs text-red-600 mt-1.5 font-medium">
            Límite alcanzado — mejora tu plan para agregar más empresas.
          </p>
        )}
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* EMPTY STATE */}
      {entities.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-4xl mb-3">🏢</p>
          <p className="font-semibold text-gray-600">No tienes empresas registradas</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Agrega tu primera empresa para empezar
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            ➕ Agregar empresa
          </button>
        </div>
      ) : (
        /* CARDS GRID */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {entities.map((entity) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              isSelected={selectedEntity?.id === entity.id}
              onSelect={() => setEntity(entity)}
              onEdit={() => setEditingEntity(entity)}
              onDelete={() => handleDelete(entity)}
            />
          ))}
        </div>
      )}

      {/* MODALS */}
      {showAddModal && (
        <AddEntityModal
          isOpen
          onClose={() => setShowAddModal(false)}
          onCreate={handleCreateEntity}
        />
      )}

      {editingEntity && (
        <EditEntityModal
          entity={editingEntity}
          onClose={() => setEditingEntity(null)}
          onSaved={async () => {
            await loadEntities();
            setEditingEntity(null);
          }}
        />
      )}
    </div>
  );
}
