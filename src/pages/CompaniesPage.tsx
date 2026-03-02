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

type CreateEntityPayload = {
  ruc: string;
  name: string;
  entityType: EntityType;
  address?: string;
  phone?: string;
  email: string;
};

export default function CompaniesPage() {
  const { user, loading } = useAuth();
  const { selectedEntity, setEntity } = useSelectedEntity();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [creating, setCreating] = useState(false);

  const navigate = useNavigate();

  /* -------------------------------------------------------------------------- */
  /* LOAD ENTITIES                                                              */
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
    if (!user) {
      setLoadingEntities(false);
      return;
    }

    let active = true;

    (async () => {
      try {
        setLoadingEntities(true);
        const data = await fetchEntities();
        if (!active) return;
        setEntities(data);
      } catch (err) {
        console.error("FETCH ENTITIES ERROR", err);
      } finally {
        if (active) setLoadingEntities(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [loading, user]);

  /* -------------------------------------------------------------------------- */
  /* DELETE ENTITY                                                              */
  /* -------------------------------------------------------------------------- */

  const handleDelete = async (entity: Entity) => {
    const confirmed = window.confirm(
      `¿Eliminar la empresa "${entity.name}"?\n\n⚠️ Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    try {
      await deleteEntity(entity.id!);

      const refreshed = await fetchEntities();
      setEntities(refreshed);

      if (selectedEntity?.id === entity.id) {
        setEntity(null);
      }
    } catch (err) {
      console.error("DELETE ENTITY ERROR", err);
      alert("❌ No se pudo eliminar la empresa.");
    }
  };

  /* -------------------------------------------------------------------------- */
  /* CREATE ENTITY FLOW                                                         */
  /* -------------------------------------------------------------------------- */

  const handleCreateEntity = async ({
    ruc,
    name,
    entityType,
    address,
    phone,
    email,
  }: CreateEntityPayload) => {
    if (creating) return;
    setCreating(true);

    try {
      // 1️⃣ Create entity
      const newEntityId = await createEntity({
        ruc: ruc.trim(),
        name: name.trim(),
        type: entityType,
        address,
        phone,
        email,
      });

      // 2️⃣ Initialize COA
      try {
        await initializeEntityCOA(newEntityId);
      } catch (err) {
        console.error("COA INIT FAILED", err);
        alert(
          "Empresa creada pero el plan de cuentas no se pudo inicializar."
        );
      }

      // 3️⃣ Refresh entities
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
  /* LOADING UI                                                                 */
  /* -------------------------------------------------------------------------- */

  if (loading || loadingEntities) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-gray-500">Cargando empresas...</p>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* RENDER                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-blue-900 mb-6">
        🏢 Empresas Registradas
      </h1>

      <button
        onClick={() => setShowAddModal(true)}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        ➕ Agregar Empresa
      </button>

      <table className="w-full border rounded shadow bg-white">
        <thead className="bg-gray-200 text-gray-700">
          <tr>
            <th className="px-4 py-2 text-left">Empresa</th>
            <th className="px-4 py-2 text-left">RUC</th>
            <th className="px-4 py-2 text-left">Tipo</th>
            <th className="px-4 py-2 text-left">Email</th>
            <th className="px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>

        <tbody>
          {entities.map((entity) => (
            <tr
              key={entity.id}
              className={`border-b hover:bg-blue-50 cursor-pointer ${
                selectedEntity?.id === entity.id ? "bg-blue-100" : ""
              }`}
              onClick={() => setEntity(entity)}
            >
              <td className="px-4 py-2">{entity.name}</td>
              <td className="px-4 py-2">{entity.ruc}</td>
              <td className="px-4 py-2">{entity.type}</td>
              <td className="px-4 py-2 text-sm text-gray-700">
                {entity.email || "-"}
              </td>

              <td className="px-3 py-2 text-right space-x-3">
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setEditingEntity(entity);
                  }}
                  className="text-blue-600 hover:underline text-sm"
                >
                  Editar
                </button>

                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    handleDelete(entity);
                  }}
                  className="text-red-600 hover:underline text-sm"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}

          {entities.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center py-6 text-gray-500">
                No tienes empresas registradas.
              </td>
            </tr>
          )}
        </tbody>
      </table>

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