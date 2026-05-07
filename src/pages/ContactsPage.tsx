// src/pages/ContactsPage.tsx

import { useEffect, useMemo, useState } from "react";
import {
  fetchContacts,
  deleteContact,
  saveContact,
} from "@/services/contactService";
import { fetchReceivables } from "@/services/receivablesService";
import { fetchPayables } from "@/services/payablesService";
import type { Contact, ContactRole } from "@/types/Contact";
import ContactFormModal from "@/components/contacts/ContactFormModal";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

// ============================================================================
// TYPES
// ============================================================================

type RoleFilter = "all" | "cliente" | "proveedor";

/** A contact as shown in the list — may be a real saved contact
 *  or a virtual entry inferred from receivables / payables */
type DisplayContact = Contact & {
  /** true  = inferred from AP/AR, NOT yet saved in the contacts collection */
  isVirtual?: boolean;
};

// ============================================================================
// HELPERS
// ============================================================================

function normalizeRuc(s?: string) {
  return (s ?? "").replace(/\s+/g, "").toUpperCase();
}

function roleBadge(role: ContactRole) {
  if (role === "cliente")
    return (
      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
        Cliente
      </span>
    );
  if (role === "proveedor")
    return (
      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
        Proveedor
      </span>
    );
  return (
    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
      Cliente / Proveedor
    </span>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ContactsPage() {
  const { selectedEntity } = useSelectedEntity();
  const entityId = selectedEntity?.id ?? "";

  const [contacts, setContacts] = useState<DisplayContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingVirtualId, setSavingVirtualId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // --------------------------------------------------------------------------
  // LOAD + MERGE
  // --------------------------------------------------------------------------

  const loadContacts = async () => {
    if (!entityId) return;
    setLoading(true);

    try {
      // Fetch all three data sources in parallel
      const [rawContacts, receivables, payables] = await Promise.all([
        fetchContacts(entityId),
        fetchReceivables(entityId).catch(() => []),
        fetchPayables(entityId).catch(() => []),
      ]);

      // Index of real contacts by normalized RUC/identification
      const byRuc = new Map<string, DisplayContact>();

      for (const c of rawContacts) {
        if (!c.activo) continue;
        const key = normalizeRuc(c.identification);
        if (key) byRuc.set(key, { ...c, isVirtual: false });
      }

      // Pull customers from receivables
      for (const r of receivables) {
        const ruc = normalizeRuc(r.customerRUC);
        if (!ruc) continue;

        if (byRuc.has(ruc)) {
          // Upgrade role to "ambos" if this contact is also a supplier
          const existing = byRuc.get(ruc)!;
          if (existing.role === "proveedor") {
            byRuc.set(ruc, { ...existing, role: "ambos" });
          }
        } else {
          byRuc.set(ruc, {
            id: `virtual-${ruc}`,
            entityId,
            role: "cliente",
            identificationType: ruc.length === 13 ? "ruc" : "cedula",
            identification: ruc,
            name: r.customerName || ruc,
            email: "",
            address: "",
            activo: true,
            createdAt: 0,
            isVirtual: true,
          });
        }
      }

      // Pull suppliers from payables
      for (const p of payables) {
        const ruc = normalizeRuc(p.supplierRUC);
        if (!ruc) continue;

        if (byRuc.has(ruc)) {
          const existing = byRuc.get(ruc)!;
          if (existing.role === "cliente") {
            byRuc.set(ruc, { ...existing, role: "ambos" });
          }
        } else {
          byRuc.set(ruc, {
            id: `virtual-${ruc}`,
            entityId,
            role: "proveedor",
            identificationType: ruc.length === 13 ? "ruc" : "cedula",
            identification: ruc,
            name: p.supplierName || ruc,
            email: "",
            address: "",
            activo: true,
            createdAt: 0,
            isVirtual: true,
          });
        }
      }

      // Sort: real contacts first, then virtual; alphabetically within each group
      const merged = [...byRuc.values()].sort((a, b) => {
        if (!!a.isVirtual !== !!b.isVirtual) return a.isVirtual ? 1 : -1;
        return a.name.localeCompare(b.name, "es");
      });

      setContacts(merged);
    } catch (err) {
      console.error("Error loading contacts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  // --------------------------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------------------------

  const handleNew = () => {
    setEditingContact(null);
    setShowModal(true);
  };

  const handleEdit = (c: DisplayContact) => {
    if (c.isVirtual) return;
    setEditingContact(c);
    setShowModal(true);
  };

  const handleDelete = async (c: DisplayContact) => {
    if (c.isVirtual) return;
    if (!confirm("¿Eliminar este contacto?")) return;
    await deleteContact(entityId, c.id);
    loadContacts();
  };

  const handleSave = () => {
    setShowModal(false);
    loadContacts();
  };

  /** Promote a virtual contact to the contacts collection */
  const handlePromote = async (c: DisplayContact) => {
    setSavingVirtualId(c.id);
    try {
      // Build payload without undefined fields — Firestore rejects them
      const payload: Parameters<typeof saveContact>[1] = {
        entityId,
        role: c.role,
        identificationType: c.identificationType,
        identification: c.identification,
        name: c.name,
        email: c.email || "",
        address: c.address || "",
        activo: true,
      };
      if (c.phone) payload.phone = c.phone;

      await saveContact(entityId, payload);
      await loadContacts();
    } catch (err: any) {
      alert(err?.message ?? "No se pudo guardar el contacto.");
    } finally {
      setSavingVirtualId(null);
    }
  };

  // --------------------------------------------------------------------------
  // FILTERS
  // --------------------------------------------------------------------------

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const text = `${c.name} ${c.identification} ${c.email ?? ""}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      const matchesRole =
        roleFilter === "all" ||
        c.role === roleFilter ||
        c.role === "ambos";
      return matchesSearch && matchesRole;
    });
  }, [contacts, search, roleFilter]);

  const totalReal    = contacts.filter((c) => !c.isVirtual).length;
  const totalVirtual = contacts.filter((c) => c.isVirtual).length;

  // --------------------------------------------------------------------------
  // GUARD
  // --------------------------------------------------------------------------

  if (!entityId) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Selecciona una empresa para administrar los contactos.</p>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <div className="w-full px-3 sm:px-6 py-4 max-w-5xl mx-auto">

      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contactos</h1>
          <p className="text-sm text-gray-500">
            Clientes y proveedores unificados
            {!loading && (
              <span className="ml-2 text-gray-400">
                · {totalReal} guardados
                {totalVirtual > 0 && `, ${totalVirtual} de facturas`}
              </span>
            )}
          </p>
        </div>

        <button
          onClick={handleNew}
          className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition"
        >
          + Nuevo Contacto
        </button>
      </div>

      {/* SEARCH + FILTER */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <input
          type="text"
          placeholder="Buscar por nombre, identificación o email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:outline-none"
        >
          <option value="all">Todos</option>
          <option value="cliente">Clientes</option>
          <option value="proveedor">Proveedores</option>
        </select>
      </div>

      {/* LOADING */}
      {loading && (
        <p className="text-center text-gray-400 py-12 animate-pulse">Cargando contactos…</p>
      )}

      {/* EMPTY */}
      {!loading && filteredContacts.length === 0 && (
        <div className="text-center py-14 text-gray-400">
          <p className="text-3xl mb-2">👤</p>
          <p className="font-medium">No hay contactos que coincidan</p>
        </div>
      )}

      {/* CARD LIST */}
      {!loading && filteredContacts.length > 0 && (
        <div className="space-y-3">
          {filteredContacts.map((c) => (
            <div
              key={c.id}
              className={`bg-white rounded-xl border p-4 transition ${
                c.isVirtual
                  ? "border-dashed border-gray-300"
                  : "border-gray-200 shadow-sm"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                {/* Info */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                    {roleBadge(c.role)}
                    {c.isVirtual && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        De facturas
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>
                      <span className="font-medium text-gray-600">RUC/ID:</span>{" "}
                      {c.identification}
                    </p>
                    {c.email && (
                      <p>
                        <span className="font-medium text-gray-600">Email:</span>{" "}
                        {c.email}
                      </p>
                    )}
                    {c.phone && (
                      <p>
                        <span className="font-medium text-gray-600">Tel:</span>{" "}
                        {c.phone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0 mt-1">
                  {c.isVirtual ? (
                    <button
                      onClick={() => handlePromote(c)}
                      disabled={savingVirtualId === c.id}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition disabled:opacity-50"
                    >
                      {savingVirtualId === c.id ? "Guardando…" : "💾 Guardar"}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(c)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
                      >
                        🗑 Eliminar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      <ContactFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        entityId={entityId}
        initialData={editingContact ?? undefined}
      />
    </div>
  );
}
