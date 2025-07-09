import { parsePDF } from "../services/journalService";
import { useState, DragEvent, ChangeEvent } from "react";
import JournalPreviewModal from "./JournalPreviewModal";

interface PDFUploaderProps {
  onUploadComplete: (journal: any[], preview: string) => void;
  userRUC?: string;
  entityId: string;
}

export default function PDFUploader({ userRUC, onUploadComplete, entityId }: PDFUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [processedCount, setProcessedCount] = useState(0);

  const [showPreview, setShowPreview] = useState(false);
  const [previewEntries, setPreviewEntries] = useState<any[]>([]);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const newFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf"
    );
    if (files.length + newFiles.length > 5) {
      setError("⚠️ You can only upload up to 5 PDF files.");
      return;
    }
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(
        (f) => f.type === "application/pdf"
      );
      if (files.length + newFiles.length > 5) {
        setError("⚠️ You can only upload up to 5 PDF files.");
        return;
      }
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleParseAll = async () => {
    if (!userRUC) {
      setError("⚠️ Please select an entity with a valid RUC before parsing.");
      return;
    }

    setLoading(true);
    setError("");
    setProcessedCount(0);
    const allJournalEntries: any[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const entries = await parsePDF(file, userRUC, entityId);
        allJournalEntries.push(...entries);
        setPreviewEntries([...allJournalEntries]); // update modal dynamically
        setShowPreview(true);
        setProcessedCount(i + 1);
      }

      if (allJournalEntries.length === 0) {
        setError("PDFs seleccionados ya se han procesado.");
        setShowPreview(false);
      }
    } catch (err: any) {
      console.error("Batch upload error:", err);
      setError("❌ Parsing error. See console for details.");
    }

    setLoading(false);
  };

  return (
    <div
      className={`p-6 min-h-[240px] border-2 border-dashed rounded-lg text-center transition flex flex-col items-center justify-center ${
        dragging ? "bg-blue-50 border-blue-400" : "bg-white"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <p className="mb-2 text-gray-700">
        {loading
          ? `⏳ Processing ${processedCount} of ${files.length}...`
          : "📤 Arrastre y deposite hasta 5 PDFs aqui o haga click para cargar"}
      </p>

      <input
        type="file"
        accept=".pdf"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        id="pdf-upload"
      />
      <label
        htmlFor="pdf-upload"
        className="cursor-pointer inline-block mt-2 px-4 py-2 text-sm font-semibold bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
      >
        Escoja los archivos
      </label>

      {files.length > 0 && (
        <div className="mt-4 text-left text-sm text-gray-600 flex flex-col items-center text-center">
          <p className="font-medium mb-1">🗂 Archivos a procesar:</p>
          <ul className="list-disc pl-5 max-h-32 overflow-y-auto">
            {files.map((file, i) => (
              <li key={i}>
                {file.name}
                {loading && i < processedCount && " ✅"}
              </li>
            ))}
          </ul>
          <button
            onClick={handleParseAll}
            disabled={loading}
            className="mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            🚀 Parse Files
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {/* 🔍 Preview Modal */}
      {showPreview && (
        <JournalPreviewModal
          entries={previewEntries}
          onCancel={() => setShowPreview(false)}
          onSave={(confirmed) => {
            setShowPreview(false);
            onUploadComplete(confirmed, `${confirmed.length} entries confirmed.`);
          }}
        />
      )}
    </div>
  );
}