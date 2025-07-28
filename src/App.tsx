import { useState } from "react";
import PDFUploader from "./components/PDFUploader";
import JournalPreview from "./components/JournalPreview";
import JournalTable from "./components/JournalTable";
import EstadosFinancieros from "./pages/FinancialReports"

interface LedgerEntry {
  date: string;
  description: string;
  debit_account: string;
  credit_account: string;
  amount: number;
}

export default function App() {
  const [ledgerData, setLedgerData] = useState<LedgerEntry[]>([]);
  const [previewText, setPreviewText] = useState("");

  const handleUploadComplete = (ledger: LedgerEntry[], preview: string) => {
    setLedgerData(ledger);
    setPreviewText(preview);
  };

  return (
    <div className="min-h-screen p-8 bg-blue-50">
      <h1 className="text-3xl font-bold mb-6 text-center text-blue-800">
        📊 Contilisto Ledger Parser
      </h1>

      {/* Grid layout for uploader and ledger */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PDFUploader onUploadComplete={handleUploadComplete} />
        {ledgerData.length > 0 && <JournalTable entries={ledgerData} />}
      </div>

      {/* Preview goes below */}
      {previewText && (
        <div className="mt-8">
          <h3 className="text-md font-semibold text-gray-600">🧾 Parsed Record Preview (bottom)</h3>
          <LedgerPreview previewText={previewText} />
        </div>
      )}
    </div>
  );
}