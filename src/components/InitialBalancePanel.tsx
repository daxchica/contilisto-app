// components/InitialBalancePanel.tsx

import React, { useState } from "react";
import ManualBalanceForm from "./ManualBalanceForm";
import BalancePDFUploader from "./BalancePDFUploader";
import BalanceSheetDisplay from "./BalanceSheetDisplay";
import { JournalEntry } from "../utils/accountMapper";

export default function InitialBalancePanel() {
  const [showPanel, setShowPanel] = useState(false);
  const [balanceEntries, setBalanceEntries] = useState<JournalEntry[]>([]);

  const handleUpload = (entries: JournalEntry[]) => {
    setBalanceEntries(entries);
  };

  return (
    <div className="mt-8 border rounded shadow p-4">
      <button
        onClick={() => setShowPanel((prev) => !prev)}
        className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800"
      >
        🧾 {showPanel ? "Hide" : "Add Initial Balance Sheet"}
      </button>

      {showPanel && (
        <div className="mt-4 space-y-6">
          <ManualBalanceForm onSave={handleUpload} />
          <BalancePDFUploader onUploadComplete={handleUpload} />
          <BalanceSheetDisplay entries={balanceEntries} />
        </div>
      )}
    </div>
  );
}