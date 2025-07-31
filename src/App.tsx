import { useState } from "react";
import PDFUploader from "./components/PDFUploader";
import JournalPreview from "./components/JournalPreview";
import JournalTable from "./components/JournalTable";
import EstadosFinancieros from "./pages/FinancialStatements";
import { JournalEntry } from "./types/JournalEntry";



export default function App() {
  const [ledgerData, setLedgerData] = useState<JournalEntry[]>([]);
  const [previewText, setPreviewText] = useState("");

  const handleUploadComplete = (ledger: any[], preview: string) => {
    const journalEntries = JournalEntry[] = ledger.map((entry, index) => ({
      id: entry.date + "-" + index,
      date: entry.date,
      account_code: entry.debit_account || entry.credit_account || "00000",
      account_name: entry.debit_account ? "Cuenta Débito" : "Cuenta Crédito",
      debit: entry.debit_account ? entry.amount : 0,
      credit: entry.credit_account ? entry.amount : 0,
      description: entry.description || "",
      invoice_number: "",
    }));

    setLedgerData(journalEntries);
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
        {ledgerData.length > 0 && (<JournalTable entries={ledgerData} />
      )}
      </div>

      {/* Preview goes below */}
      {previewText && (
        <div className="mt-8">
          <h3 className="text-md font-semibold text-gray-600">🧾 Parsed Record Preview (bottom)</h3>
          <JournalPreview previewText={previewText} />
        </div>
      )}
    </div>
  );
}