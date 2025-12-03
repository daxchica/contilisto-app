// src/components/clients/ClientSelect.tsx
import React, { useState, useEffect } from "react";
import { fetchClients, Client } from "@/services/clientService";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

interface Props {
  value: Client | null;
  onChange: (client: Client) => void;
}

const ClientSelect: React.FC<Props> = ({ value, onChange }) => {
  const { selectedEntity } = useSelectedEntity();
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!selectedEntity?.id) return;
    fetchClients(selectedEntity.id).then(setClients);
  }, [selectedEntity]);

  const filtered = clients.filter((c) =>
    c.razon_social.toLowerCase().includes(query.toLowerCase()) ||
    c.identificacion.includes(query) ||
    (c.email ?? "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative w-full">
      <label className="text-sm text-gray-600 mb-1 block">Cliente</label>

      {/* INPUT PRINCIPAL */}
      <input
        type="text"
        value={value ? value.razon_social : query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        placeholder="Buscar cliente por nombre, RUC o email..."
      />

      {/* LISTA DESPLEGABLE */}
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg max-h-60 overflow-y-auto z-50">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-gray-500">No hay coincidencias</div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onChange(c);
                  setQuery("");
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                <div className="font-medium">{c.razon_social}</div>
                <div className="text-xs text-gray-500">
                  {c.identificacion} — {c.email}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ClientSelect;