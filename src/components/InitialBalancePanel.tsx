// components/InitialBalancePanel.tsx

import React, { useState } from "react";
import ManualBalanceForm, { Entry as ManualBalanceEntry } from "./ManualBalanceForm";
import BalancePDFUploader from "./BalancePDFUploader";
import BalanceSheet from "./BalanceSheet";
import type { JournalEntry } from "../types/JournalEntry";
import type { Account } from "../types/AccountTypes";

interface Props {
  entityId: string;
  userId: string;
  accounts: Account[];
}

export default function InitialBalancePanel({ entityId, accounts }: Props) {

  const [showPanel, setShowPanel] = useState(false);
  const [balanceEntries, setBalanceEntries] = useState<JournalEntry[]>([]);
  const [showSavedMessage, setShowSavedMessage] = useState(false);

  // --------------------------------------------------------------------------
  // Merge helper (evita duplicados por account_code + entityId)
  // --------------------------------------------------------------------------
  const mergeEntries = (
    prev: JournalEntry[],
    incoming: JournalEntry[]
  ): JournalEntry[] => {
    const result = [...prev];

    incoming.forEach((entry) => {
      const exists = result.some(
        (e) =>
          e.account_code === entry.account_code && 
          e.entityId === entry.entityId
      );
      if (!exists) result.push(entry);
    });

    return result;
  };

  // --------------------------------------------------------------------------
  // Manejar envío MANUAL (desde ManualBalanceForm)
  // --------------------------------------------------------------------------
  const handleManualSubmit = (entries: ManualBalanceEntry[]) => {
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    const normalized: JournalEntry[] = entries.map((e) => ({
      id: crypto.randomUUID(),
      entityId,
      account_code: e.account_code,
      account_name: e.account_name,
      debit: e.debit ?? 0,
      credit: e.credit ?? 0,
      description: "Asiento de Balance Inicial (manual)",
      date: e.date || today,
      source: "initial" as const,
      createdAt: now,
    }));
    
    // Opcional: evitar duplicados por account_code
    const unique = normalized.filter(
      (entry) => 
        !balanceEntries.some(
          (e) => 
            e.account_code === entry.account_code && 
            e.entityId === entry.entityId
        )
    );

    setBalanceEntries((prev) => mergeEntries(prev, normalized));
    setShowSavedMessage(true);
    setTimeout(() => setShowSavedMessage(false), 3000);
  };

  // --------------------------------------------------------------------------
  // Manejar BALANCE desde PDF
  // --------------------------------------------------------------------------
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

    setBalanceEntries((prev) => mergeEntries(prev, normalized));
    setShowSavedMessage(true);
    setTimeout(() => setShowSavedMessage(false), 3000);
  };

  console.log("📌 Accounts recibidos en InitialBalancePanel:", accounts.length);

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
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
          {/* MANUAL FORM */}
          <ManualBalanceForm 
            entityId={entityId}
            accounts={accounts}
            onSubmit={handleManualSubmit}
          />

            {/* UPLOAD PDF */}
            <BalancePDFUploader onUploadComplete={handleUpload} />

            {/* BALANCE PREVIEW */}
            {balanceEntries.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-blue-700 mb-2">
                  Vista previa del Balance Inicial
                </h3>
                <BalanceSheet 
                  entries={balanceEntries} 
                  resultadoDelEjercicio={0} 
                  entityId={entityId}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }