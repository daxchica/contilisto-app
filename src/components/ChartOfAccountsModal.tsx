// src/components/ChartOfAccountsModal.tsx
import React, { useMemo, useState } from "react";
import { Account } from "../types/AccountTypes"; // Asegúrate de tener este tipo definido

interface Props {
  accounts: Account[];
  onClose: () => void;
}

export default function ChartOfAccountsModal({ accounts, onClose }: Props) {
    const [q, setQ] = useState("");

    const filtered = useMemo(() => {
        if (!q.trim()) return accounts;
        const needle = q.toLowerCase();
        return accounts.filter(
            (a) =>
                a.code.toLowerCase().includes(needle) ||
                a.name.toLowerCase().includes(needle)
        );
    }, [accounts, q]);

    // Cerrar con ESC
    React.useEffect(() => {
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onEsc);
        return () => window.removeEventListener("keydown", onEsc);
    }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coa-title"
      onClick={onClose} // click en backdrop cierra
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 p-5 flex flex-col"
        onClick={(e) => e.stopPropagation()} // evita cerrar al hacer click dentro
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
            <h2 
                id="coa-title" 
                className="text-xl font-bold text-center w-full"
            >
                    Plan de Cuentas
            </h2>
            <button
                onClick={onClose}
                className="px-3 py-1 rounded border hover:bg-gray-50"
                aria-label="Cerrar"
            >
                Cerrar
            </button>
            </div>

            {/* Search */}
            <input
                type="text"
                placeholder="Buscar por código o nombre…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full border rounded px-3 py-2 mb-3"
            />

            {/* Table (sticky header + scrollable body) */}
            {filtered.length === 0 ? (
                <p className="text-sm text-gray-600">
                    {accounts.length === 0
                        ? "No hay cuentas detectadas aún. Carga o genera asientos para verlas aquí."
                        : "No se encontraron cuentas que coincidan con tu búsqueda."}
                </p>
            ) : (
              <div className="max-h-[55vh] overflow-auto border rounded">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                    <tr>
                        <th className="text-left px-3 py-2 w-40">Código</th>
                        <th className="text-left px-3 py-2">Nombre</th>
                    </tr>
                    </thead>
                    <tbody>
                        {filtered.map((a) => (
                            <tr key={a.code} className="border-t">
                                <td className="px-3 py-2 font-mono">{a.code}</td>
                                <td className="px-3 py-2">{a.name}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
            )}
        </div>
        </div>
  );
}
