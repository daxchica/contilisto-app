// src/components/invoice/InvoiceClientSelector.tsx
import React, { useState, useMemo } from "react";
import { Client } from "@/services/clientService";

export interface InvoiceClientSelectorProps {
  clients: Client[];
  loading: boolean;
  value: Client | null;
  onChange: (client: Client | null) => void;
}

const InvoiceClientSelector: React.FC<InvoiceClientSelectorProps> = ({
  clients,
  loading,
  value,
  onChange,
}) => {
  const [query, setQuery] = useState("");

  // Filter clients on search-as-you-type
  const filtered = useMemo(() => {
    if (!query.trim()) return clients;

    const q = query.toLowerCase();
    return clients.filter(
      (c) =>
        c.razon_social.toLowerCase().includes(q) ||
        c.identificacion.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
    );
  }, [query, clients]);

  return (
    <div className="w-full">

      {/* Search input */}
      <input
        type="text"
        placeholder="Buscar cliente por nombre, ID, o email..."
        className="w-full border rounded-lg px-3 py-2 mb-3"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* Loading */}
      {loading && (
        <div className="text-gray-500 text-sm py-2">Cargando Clientes...</div>
      )}

      {/* Client list */}
      {!loading && filtered.length === 0 && (
        <div className="text-gray-500 text-sm py-2">
          No hay clientes con el criterio solicitado.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => onChange(c)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-100 transition ${
                value?.id === c.id ? "bg-blue-50" : ""
              }`}
            >
              <div className="font-semibold">{c.razon_social}</div>
              <div className="text-sm text-gray-600">{c.identificacion}</div>
              {c.email && (
                <div className="text-xs text-gray-500">{c.email}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Clear selection */}
      {value && (
        <button
          onClick={() => onChange(null)}
          className="mt-2 text-sm text-red-600 hover:underline"
        >
          Limpiar la sección de clientes
        </button>
      )}
    </div>
  );
};

export default InvoiceClientSelector;