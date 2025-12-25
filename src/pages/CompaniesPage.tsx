// src/pages/CompaniesPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { Entity, EntityType } from "@/types/Entity"
import { useAuth } from "@/context/AuthContext";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { fetchEntities, createEntity, deleteEntity } from "@/services/entityService";

import AddEntityModal from "@/components/modals/AddEntityModal";
import EditEntityModal from "@/components/entity/EditEntityModal";

type CreateEntityPayload = {
  ruc: string;
  name: string;
  entityType: EntityType;
}

export default function CompaniesPage() {
  const { user, loading } = useAuth();
  const { selectedEntity, setEntity } = useSelectedEntity();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const navigate = useNavigate();

  // Load entities
  useEffect(() => {
    if (loading) return;
    if (!user?.uid) return;

    const load = async () => {
      
      const data = await fetchEntities(user.uid);
      setEntities(data);
    };
    load();
  }, [loading, user?.uid]);

  console.log("AUTH LOADING:", loading);
  console.log("AUTH USER UID:", user?.uid);
  console.log("ENTITIES:", entities);

  if (loading) return null;

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

      {/* Table */}
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
                  onClick={async (ev) => {
                    ev.stopPropagation();

                    const confirmed = window.confirm(
                      `¿Eliminar la empresa "${entity.name}"?\n\n⚠️ Esta acción no se puede deshacer.`
                    );
                    if (!confirmed) return;

                    try {
                      await deleteEntity(entity.id!);

                      // Refresh list
                      const refreshed = await fetchEntities(user!.uid);
                      setEntities(refreshed);

                      // If deleted entity was selected → clear it
                      if (selectedEntity?.id === entity.id) {
                        setEntity(null);
                      }

                      alert("✔ Empresa eliminada correctamente.");
                    } catch (err) {
                      console.error(err);
                      alert("❌ No se pudo eliminar la empresa.");
                    }
                  }}
                  className="text-red-600 hover:underline text-sm"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showAddModal && (
        <AddEntityModal
          isOpen={true}
          onClose={() => setShowAddModal(false)}
          onCreate={async ({ ruc, name, entityType }: CreateEntityPayload) => {
            if (!user?.uid) return;

            const newEntityId = await createEntity({
              ruc: ruc.trim(),
              name: name.trim(),
              type: entityType,
            });

            // Refresh table
            const data = await fetchEntities(user.uid);
            setEntities(data);

            // Auto-select just created company
            const created = data.find(e => e.id === newEntityId);
            if (created) {
              setEntity(created);
              navigate("/dashboard");
            }

            alert("✔ Empresa agregada correctamente.");
            setShowAddModal(false);
          }}
        />
      )}

      {editingEntity && user?.uid && (
        <EditEntityModal
          entity={editingEntity}
          onClose={() => setEditingEntity(null)}
          onSaved={async () => {
            const refreshed = await fetchEntities(user.uid);
            setEntities(refreshed);
            setEditingEntity(null);
          }}
        />
      )}
    </div>
  );
}