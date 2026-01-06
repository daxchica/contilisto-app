// src/components/entity/JournalSection.tsx

import React from "react";
import type { JournalEntry } from "../../types/JournalEntry";
import JournalTable from "@/components/journal/JournalTable";
import { saveJournalEntries } from "../../services/journalService";

interface Props {
  entries: JournalEntry[];
  entityId: string;
  entityName: string;
  userId: string;
  onSaved: () => void;
}

export default function JournalSection({ entries, entityId, entityName, userId, onSaved }: Props) {
  const isBalanced = (): boolean => {
    const debit = entries.reduce((sum, e) => sum + (e.debit ?? 0), 0);
    const credit = entries.reduce((sum, e) => sum + (e.credit ?? 0), 0);
    return Math.abs(debit - credit) < 0.01;
  };

  const handleSave = async () => {
    if (!entityId || !userId) {
      alert("Entidad o usuario no definidos.");
      return;
    }
    try {
      const withMeta = entries.map((e) => ({
        ...e,
        entityId,
        userId,
        createdAt: Date.now(),
        source: e.source ?? "manual",
      }));
      await saveJournalEntries(entityId, withMeta, userId);
      onSaved();
    } catch (err) {
      console.error("Error al guardar asientos:", err);
      alert("Error al guardar asientos contables");
    }
  };

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">Registros de Diario ({entries.length})</h3>
        <div className="flex items-center gap-4">
          <span className={`text-sm ${isBalanced() ? "text-green-600" : "text-red-600"}`}>
            {isBalanced() ? "✅ Asiento Cuadrado" : "⚠️ No Cuadrado"}
          </span>
          <button
            onClick={handleSave}
            disabled={!isBalanced()}
            className={`px-3 py-1 rounded text-white font-medium transition-all ${
              isBalanced() ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Guardar Registros
          </button>
        </div>
      </div>
      <JournalTable 
        entries={entries} 
        entityName={entityName} 
      />
    </div>
  );
}