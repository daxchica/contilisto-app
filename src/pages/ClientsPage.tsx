// src/pages/ClientsPage.tsx
import React, { useEffect, useState } from "react";
import { fetchClients, deleteClient, Client } from "@/services/clientService";
import ClientFormModal from "@/components/clients/ClientFormModal";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

export default function ClientsPage() {
  const { selectedEntity } = useSelectedEntity();

  const entityId = selectedEntity?.id ?? "";
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  /* ==============================
      FETCH CLIENT LIST
  ============================== */
  const loadClients = async () => {
    if (!entityId) return;
    setLoading(true);
    const data = await fetchClients(entityId);
    setClients(data);
    setLoading(false);
  };

  useEffect(() => {
    loadClients();
  }, [entityId]);

  /* =======================================================
     Handlers
  ======================================================= */
  const handleNew = () => {
    setEditingClient(null);
    setShowModal(true);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este cliente?")) return;
    await deleteClient(entityId, id);
    loadClients();
  };

  const handleSave = () => {
    loadClients();
  };

  if (!entityId) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-700">
        Selecciona una empresa para administrar los clientes.
      </h1>
    </div>
  );
}

  /* =======================================================
     Render
  ======================================================= */

  return (
    <div className="flex flex-col w-full h-full px-8 py-6">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500">Administración de clientes</p>
        </div>

        <button
          onClick={handleNew}
          className="bg-[#0A3558] text-white px-4 py-2 rounded-lg shadow hover:bg-[#0c426f] transition"
        >
          + Nuevo Cliente
        </button>
      </div>


      {/* TABLA */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100 text-left text-gray-600 text-sm">
            <tr>
              <th className="px-4 py-3">Nombre / Razón Social</th>
              <th className="px-4 py-3">Identificación</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-500">
                  Cargando clientes...
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-500">
                  No hay clientes registrados aún.
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 text-sm">
                  <td className="px-4 py-3">{c.razon_social}</td>
                  <td className="px-4 py-3">{c.identificacion}</td>
                  <td className="px-4 py-3">{c.email}</td>
                  <td className="px-4 py-3">{c.telefono}</td>
                  <td className="px-4 py-3 capitalize">{c.tipo_cliente}</td>

                  <td className="px-4 py-3 text-center">

                    {/* EDITAR */}
                    <button
                        className="text-blue-600 hover:underline mr-4"
                        onClick={() => handleEdit(c)}
                    >
                      ✏️ Editar
                    </button>

                    {/* ELIMINAR */}
                    <button
                        className="text-red-600 hover:underline"
                        onClick={() => handleDelete(c.id)}      
                    >
                      🗑️ Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL CREAR / EDITAR */}
      <ClientFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        entityId={entityId}
        initialData={editingClient}
      />
    </div>
  );
}