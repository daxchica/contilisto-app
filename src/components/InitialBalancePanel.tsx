// components/InitialBalancePanel.tsx

import React, { useState } from "react";
import ManualBalanceForm from "./ManualBalanceForm";
import BalancePDFUploader from "./BalancePDFUploader";
import BalanceSheetDisplay from "./BalanceSheetDisplay";
import { JournalEntry } from "../types/JournalEntry";

interface Props {
  entityId: string;
}

export default function InitialBalancePanel({ entityId }: Props) {
  const [showPanel, setShowPanel] = useState(false);
  const [balanceEntries, setBalanceEntries] = useState<JournalEntry[]>([]);

  const handleUpload = (entries: JournalEntry[]) => {
    const now = Date.now();
    const normalized = entries.map(e => ({
      ...e,
      entityId,
      createdAt: now,
      source: e.source ?? "manual",
      description: e.description ?? "Asiento de Balance Inicial",
    }));
    setBalanceEntries(normalized);
  };

  return (
    <div className="mt-8 border rounded shadow p-4">
      <button
        onClick={() => setShowPanel((prev) => !prev)}
        className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800"
      >
        🧾 {showPanel ? "Ocultar" : "Carga el Balance Inicial"}
      </button>

      {showPanel && (
        <div className="mt-4 space-y-6">
          <ManualBalanceForm 
            entityId={entityId}
            onSubmit={(entries) => {
              const today = new Date().toISOString().slice(0, 10);
              const asJournal: JournalEntry[] = entries.map(e => ({
                ...e,
                date: today,
                entityId,
                createdAt: Date.now(),
                source: "manual",
                description: "Asiento de Balance Inicial",
              }));
              handleUpload(asJournal);
            }} 
          />
          <BalancePDFUploader onUploadComplete={handleUpload} />
          <BalanceSheetDisplay entries={balanceEntries} />
        </div>
      )}
    </div>
  );
}