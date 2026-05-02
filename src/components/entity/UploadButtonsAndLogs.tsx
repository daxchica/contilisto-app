// src/components/entity/UploadButtonsAndLogs.tsx

import React from "react";
import ManualEntryModal from "@/components/modals/ManualEntryModal";
import { JournalEntry } from "@/types/JournalEntry";

type ProcessedLog = {
  id?: string;
  invoiceNumber?: string;
  date?: string;
};

interface Props {
  entityId: string;
  userIdSafe: string;
  userRUC?: string;
  accounts: any[];
  logs: ProcessedLog[];
  setLogs: (logs: ProcessedLog[]) => void;
  onUploadComplete: (entries: JournalEntry[], preview: string) => void;
  onAddManualEntry: (entries: JournalEntry[]) => void;
}

export default function UploadButtonsAndLogs({
  entityId,
  userIdSafe,
  accounts,
  logs,
  setLogs,
  onAddManualEntry,
}: Props) {
  const [showManualModal, setShowManualModal] = React.useState(false);

  const handleClearLogs = () => {
    if (confirm("¿Estás seguro de borrar los logs procesados?")) {
      setLogs([]);
      // No borramos firestore aquí — solo la vista local
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        
        <button
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded"
          onClick={() => setShowManualModal(true)}
        >
          Cargar Manual
        </button>

        <button
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          onClick={handleClearLogs}
        >
          Borrar Logs de facturas procesadas
        </button>
      </div>

      {logs.length > 0 && (
        <div className="text-sm text-gray-500">
          🧾 {logs.length} facturas procesadas esta sesión.
        </div>
      )}

      {showManualModal && (
        <ManualEntryModal
          onClose={() => setShowManualModal(false)}
          onAddEntries={async (entries) => { onAddManualEntry(entries); }}
          entityId={entityId}
          userIdSafe={userIdSafe}
          postableAccounts={accounts}
          leafCodeSet={new Set()}
        />
      )}
    </div>
  );
}