// src/components/ChartOfAccountsModal.tsx
import React, { useMemo, useState } from "react";
import type { Account } from "../types/AccountTypes"
import { ECUADOR_COA } from "../data/ecuador_coa";

type Props = {
  accounts?: Account[];
  onClose: () => void;
};

// normalize accents for searching
function normalize (s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export default function ChartOfAccountsModal({ accounts, onClose }: Props) {
  const [query, setQuery] = useState("");

  // Use the provided list or the full Ecuador COA; keep a stable, sorted copy
  const source = useMemo(
    () =>
      (accounts && accounts.length ? accounts : ECUADOR_COA)
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true })),
    [accounts]
  );

  // Filter by code or name (accent-insensitive)
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return source;
    return source.filter((a) => a.code.includes(q) || normalize(a.name).includes(q));
  }, [query, source]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-3xl w-[90vw]">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-lg font-semibold">Plan de Cuentas</h2>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </div>

        <div className="p-4">
          <input
            type="text"
            placeholder="Buscar por código o nombre…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-3"
          />

          <div className="max-h-[60vh] overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 w-40">Código</th>
                  <th className="text-left px-3 py-2">Nombre</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.code} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono">{a.code}</td>
                    <td className="px-3 py-2">{a.name}</td>
                  </tr>
                ))}

                {!filtered.length && (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-500" colSpan={2}>
                      No se encontraron cuentas para “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

 