// components/InitialBalancePanel.tsx

import React, { useState } from "react";
import ManualBalanceForm from "./ManualBalanceForm";
import BalancePDFUploader from "./BalancePDFUploader";
import BalanceSheet from "./BalanceSheet";
import { JournalEntry } from "../types/JournalEntry";
import { Account } from "../../shared/coa/ecuador_coa";

interface Props {
  entityId: string;
  userId: string;
  accounts: Account[];
}

export default function InitialBalancePanel({ entityId }: Props) {
  const [showPanel, setShowPanel] = useState(false);
  const [balanceEntries, setBalanceEntries] = useState<JournalEntry[]>([]);
  const [showSavedMessage, setShowSavedMessage] = useState(false);

  const handleUpload = (entries: JournalEntry[]) => {
    const now = Date.now();

    const normalized: JournalEntry[] = entries.map((e) => ({
      ...e,
      entityId,
      createdAt: now,
      source: "initial" as const,
      description: e.description ?? "Asiento de Balance Inicial",
      date: e.date || new Date().toISOString().slice(0, 10),
    }));
    
    // Opcional: evitar duplicados por account_code
    const unique = normalized.filter(
      (entry) => !balanceEntries.some((e) => e.account_code === entry.account_code && e.entityId === entry.entityId)
    );
    setBalanceEntries((prev) => [...prev, ...unique]);
    setShowSavedMessage(true);
    setTimeout(() => setShowSavedMessage(false), 3000);
  };

  return (
    <div className="mt-8 border rounded shadow p-4 bg-white">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowPanel((prev) => !prev)}
          className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800"
        >
          🧾 {showPanel ? "Ocultar" : "Carga el Balance Inicial"}
        </button>

        {showSavedMessage && (
          <span className="text-green-600 text-sm font-semibold">
            ✅ Balance inicial cargado correctamente
          </span>
        )}
      </div>

        {showPanel && (
          <div className="mt-4 space-y-6">
            {/* Formulario Manual */}
            <ManualBalanceForm 
              entityId={entityId}
              onSubmit={(entries) => {
                const asJournal: JournalEntry[] = entries.map((e) => ({
                  ...e,
                  entityId,
                  date: e.date || new Date().toISOString().slice(0, 10),
                  createdAt: Date.now(),
                  source: "initial" as const,
                  description: "Asiento de Balance Inicial",
                }));
                handleUpload(asJournal);
              }} 
            />
            <BalancePDFUploader onUploadComplete={handleUpload} />


            {/* Vista previa del Balance Inicial */}
            {balanceEntries.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-blue-700 mb-2">
                  Vista previa del Balance Inicial
                </h3>
                <BalanceSheet entries={balanceEntries} resultadoDelEjercicio={0} entityId={entityId}/>
            </div>
          )}
        </div>
      )}
    </div>
    );
  }