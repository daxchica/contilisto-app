// src/pages/CompaniesPage.tsx
import React, { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/firebase-config";

import { Entity } from "@/types/Entity";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { fetchEntities } from "@/services/entityService";

import AddEntityModal from "@/components/AddEntityModal";

export default function CompaniesPage() {
  const [user] = useAuthState(auth);
  const { selectedEntity, setEntity } = useSelectedEntity();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Load entities
  useEffect(() => {
    const load = async () => {
      if (!user?.uid) return;
      const data = await fetchEntities(user.uid);
      setEntities(data);
    };

    load();
  }, [user?.uid]);

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
            <th className="px-4 py-2"></th>
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
              <td className="px-4 py-2 text-right">
                {selectedEntity?.id === entity.id && (
                  <span className="text-green-600 font-semibold text-sm">
                    Seleccionada
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showAddModal && (
        <AddEntityModal
          isOpen={true}
          onClose={() => setShowAddModal(false)}
          onCreate={async ({ ruc, name, entityType }) => {
            if (!user?.uid) return;

            // Save
            const resp = await fetch("/api/createEntity", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ruc: ruc.trim(),
                name: name.trim(),
                type: entityType,
                uid: user.uid,
              }),
            });

            await resp.json();

            // Refresh table
            const data = await fetchEntities(user.uid);
            setEntities(data);

            alert("✔ Empresa agregada correctamente.");
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}