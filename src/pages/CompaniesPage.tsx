// src/pages/CompaniesPage.tsx
import React, { useEffect, useState } from "react";
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

type CreateEntityPayload = {
  ruc: string;
  name: string;
  entityType: EntityType;
};

export default function CompaniesPage() {
  const { user, loading } = useAuth();
  const { selectedEntity, setEntity } = useSelectedEntity();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);

  const navigate = useNavigate();

  /* -------------------------------------------------------------------------- */
  /* LOAD ENTITIES                                                              */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setLoadingEntities(false);
      return;
    }

    const load = async () => {
      try {
        setLoadingEntities(true);
        const data = await fetchEntities(); // 🔥 service handles uid internally
        setEntities(data);
      } catch (e) {
        console.error("FETCH ENTITIES ERROR", e);
        alert("No se pudo cargar empresas. Revisa permisos en consola.");
      } finally {
        setLoadingEntities(false);
      }
    };

    load();
  }, [loading, user]);

  /* -------------------------------------------------------------------------- */
  /* LOADING STATE                                                              */
  /* -------------------------------------------------------------------------- */

  if (loading || loadingEntities) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-gray-500">Cargando empresas...</p>
      </div>
    );
  }

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

      alert("✔ Empresa eliminada correctamente.");
    } catch (err) {
      console.error(err);
      alert("❌ No se pudo eliminar la empresa.");
    }
  };

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
          onCreate={async ({
            ruc,
            name,
            entityType,
          }: CreateEntityPayload) => {
            const newEntityId = await createEntity({
              ruc: ruc.trim(),
              name: name.trim(),
              type: entityType,
            });

            const data = await fetchEntities();
            setEntities(data);

            const created = data.find((e) => e.id === newEntityId);
            if (created) {
              setEntity(created);
              navigate("/dashboard");
            }

            alert("✔ Empresa agregada correctamente.");
            setShowAddModal(false);
          }}
        />
      )}

      {editingEntity && (
        <EditEntityModal
          entity={editingEntity}
          onClose={() => setEditingEntity(null)}
          onSaved={async () => {
            const refreshed = await fetchEntities();
            setEntities(refreshed);
            setEditingEntity(null);
          }}
        />
      )}
    </div>
  );
}