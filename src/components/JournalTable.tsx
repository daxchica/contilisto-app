// ============================================================================
// JournalTable.tsx — Fixed width table (no scroll)
// ============================================================================
import React, { useState, useMemo } from "react";
import type { JournalEntry } from "../types/JournalEntry";

interface Props {
  entries: JournalEntry[];
  entityName: string;
  onSelectEntries: (entries: JournalEntry[]) => void;
  onDeleteSelected: () => Promise<void>;
  onSave: () => void;
}

export default function JournalTable({
  entries,
  entityName,
  onSelectEntries,
  onDeleteSelected,
}: Props) {

  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});

  const selectedCount = useMemo(
    () => Object.values(selectedMap).filter(Boolean).length,
    [selectedMap]
  );

  const selectedEntriesArray = useMemo(
    () => entries.filter(e => selectedMap[e.id]),
    [entries, selectedMap]
  );

  React.useEffect(() => {
    onSelectEntries(selectedEntriesArray);
  }, [selectedEntriesArray, onSelectEntries]);

  const toggleItem = (id: string) => {
    setSelectedMap(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleAll = () => {
    if (selectedCount === entries.length) {
      setSelectedMap({});
      return;
    }

    const next: Record<string, boolean> = {};
    entries.forEach(e => (next[e.id] = true));
    setSelectedMap(next);
  };

  return (
    <div className="w-full">

      {/* HEADER BUTTONS RIGHT */}
      <div className="flex justify-end px-8 py-3 bg-white border-b border-gray-300 rounded-t shadow-sm relative">

        <div className="absolute left-8 text-sm text-gray-700">
          Seleccionados: {selectedCount} / {entries.length}
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => alert("Generar PDF Coming Soon!")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            📄 Exportar a PDF
          </button>

          <button
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded disabled:opacity-30"
          >
            🗑 Eliminar seleccionados
          </button>
        </div>

      </div>

      {/* FIXED WIDTH TABLE */}
      <table className="mx-auto w-[82%] bg-white text-sm border border-gray-200 shadow-sm rounded-b">

        <thead>
          <tr className="bg-gray-100 text-left text-xs text-gray-600 uppercase border-b">
            <th className="px-3 py-2 w-[35px]">
              <input
                type="checkbox"
                checked={selectedCount === entries.length}
                onChange={toggleAll}
              />
            </th>

            <th className="px-3 py-2 w-[100px]">Fecha</th>
            <th className="px-3 py-2 w-[120px]">Factura</th>
            <th className="px-3 py-2 w-[100px]">Código</th>

            <th className="px-3 py-2 w-[200px] text-left">
              Nombre de Cuenta
            </th>

            <th className="px-3 py-2 w-[130px] text-right">Débito</th>
            <th className="px-3 py-2 w-[130px] text-right">Crédito</th>
          </tr>
        </thead>

        <tbody>
          {entries.map(entry => (
            <tr
              key={entry.id}
              className="border-b hover:bg-gray-50 transition"
            >
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={!!selectedMap[entry.id]}
                  onChange={() => toggleItem(entry.id)}
                />
              </td>

              <td className="px-3 py-2">{entry.date ?? "-"}</td>
              <td className="px-3 py-2">{entry.invoice_number ?? "-"}</td>
              <td className="px-3 py-2">{entry.account_code}</td>

              <td className="px-3 py-2 truncate">{entry.account_name}</td>

              <td className="px-3 py-2 text-right">{entry.debit?.toFixed(2)}</td>
              <td className="px-3 py-2 text-right">{entry.credit?.toFixed(2)}</td>
            </tr>
          ))}

          {entries.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-6 text-gray-500">
                No hay registros todavía.
              </td>
            </tr>
          )}
        </tbody>

      </table>

    </div>
  );
}