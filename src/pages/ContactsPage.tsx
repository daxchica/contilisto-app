// src/pages/ContactsPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  fetchContacts,
  deleteContact,
} from "@/services/contactService";
import { Contact } from "@/types/Contact";
import ContactFormModal from "@/components/contacts/ContactFormModal";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

type RoleFilter = "all" | "cliente" | "proveedor";



export default function ContactsPage() {
  const { selectedEntity } = useSelectedEntity();
  const entityId = selectedEntity?.id ?? "";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  /* ======================================================
     Fetch
  ====================================================== */
  const loadContacts = async () => {
    if (!entityId) return;
    setLoading(true);
    const data = await fetchContacts(entityId);
    setContacts(data.filter((c) => c.activo));
    setLoading(false);
  };

  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  /* ======================================================
     Handlers
  ====================================================== */
  const handleNew = () => {
    setEditingContact(null);
    setShowModal(true);
  };

  const handleEdit = (c: Contact) => {
    setEditingContact(c);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este contacto?")) return;
    await deleteContact(entityId, id);
    loadContacts();
  };

  const handleSave = () => {
    setShowModal(false);
    loadContacts();
  };

  /* ======================================================
     Filters
  ====================================================== */
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const text = `${c.name} ${c.identification} ${
        c.email ?? ""
      }`.toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());

      const matchesRole =
        roleFilter === "all" || 
        c.role === roleFilter ||
        c.role === "ambos";

      return matchesSearch && matchesRole;
    });
  }, [contacts, search, roleFilter]);

  /* ======================================================
     Guards
  ====================================================== */
  if (!entityId) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-700">
          Selecciona una empresa para administrar los contactos.
        </h1>
      </div>
    );
  }

  /* ======================================================
     Render
  ====================================================== */
  return (
    <div className="flex flex-col w-full h-full px-4 sm:px-8 py-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contactos</h1>
          <p className="text-gray-500">
            Clientes y Proveedores unificados
          </p>
        </div>

        <button
          onClick={handleNew}
          className="w-full sm:w-auto bg-[#0A3558] text-white px-5 py-3 rounded-lg shadow hover:bg-[#0c426f] transition font-semibold"
        >
          + Nuevo Contacto
        </button>
      </div>

      {/* SEARCH & FILTER */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Buscar por nombre, identificación o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={roleFilter}
          onChange={(e) =>
            setRoleFilter(e.target.value as RoleFilter)
          }
          className="px-4 py-3 rounded-xl border border-gray-300 bg-white focus:outline-none"
        >
          <option value="all">Todos</option>
          <option value="cliente">Clientes</option>
          <option value="proveedor">Proveedores</option>
        </select>
      </div>

      {/* MOBILE VIEW */}
      <div className="space-y-4 md:hidden">
        {loading ? (
          <p className="text-center text-gray-500 py-10">
            Cargando contactos...
          </p>
        ) : filteredContacts.length === 0 ? (
          <p className="text-center text-gray-500 py-10">
            No hay contactos que coincidan con tu búsqueda.
          </p>
        ) : (
          filteredContacts.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl shadow p-4 space-y-2"
            >
              <div>
                <p className="font-semibold text-gray-900">
                  {c.name}
                </p>
                <p className="text-sm text-gray-500">
                  {c.role === "ambos"
                    ? "Cliente / Proveedor"
                    : c.role}
                </p>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <strong>ID:</strong> {c.identification}
                </p>
                <p>
                  <strong>Email:</strong> {c.email || "—"}
                </p>
                <p>
                  <strong>Tel:</strong> {c.phone || "—"}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleEdit(c)}
                  className="flex-1 py-2 rounded-lg border text-blue-700 font-medium"
                >
                  ✏️ Editar
                </button>

                <button
                  onClick={() => handleDelete(c.id)}
                  className="flex-1 py-2 rounded-lg border text-red-600 font-medium"
                >
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100 text-left text-gray-600 text-sm">
            <tr>
              <th className="px-4 py-3">Nombre / Razón Social</th>
              <th className="px-4 py-3">Identificación</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-10 text-gray-500"
                >
                  Cargando contactos...
                </td>
              </tr>
            ) : filteredContacts.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-10 text-gray-500"
                >
                  No hay contactos que coincidan con tu búsqueda.
                </td>
              </tr>
            ) : (
              filteredContacts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 text-sm">
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3">{c.identification}</td>
                  <td className="px-4 py-3">{c.email || "—"}</td>
                  <td className="px-4 py-3 capitalize">
                    {c.role === "ambos"
                        ? "Cliente / Proveedor"
                        : c.role}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <button
                      className="text-blue-600 hover:underline mr-4"
                      onClick={() => handleEdit(c)}
                    >
                      ✏️ Editar
                    </button>

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

      {/* MODAL */}
      <ContactFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        entityId={entityId}
        initialData={editingContact}
      />
    </div>
  );
}