import { useState, DragEvent, ChangeEvent, useRef } from "react";
import { parsePDF } from "../services/journalService";
import JournalPreviewModal from "./JournalPreviewModal";
import type { JournalEntry } from "../types/JournalEntry";
import type { Account } from "../types/AccountTypes";
import { getAccountsForUI } from "../utils/accountPUCMap";

interface PDFUploaderProps {
  onUploadComplete: (journal: JournalEntry[], preview: string) => void;
  userRUC?: string;
  entityId: string;
  userId: string;
  accounts: Account[];
}

export default function PDFUploader({
  userRUC,
  entityId,
  userId,
  accounts,
  onUploadComplete,
}: PDFUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewEntries, setPreviewEntries] = useState<JournalEntry[]>([]);
  const [processedFiles, setProcessedFiles] = useState<string[]>([]); // (optional)

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );
    if (dropped.length === 0) {
      setError("Solo se aceptan archivos PDF.");
      return;
    }
    await handleFiles(dropped);
  };

  const handleFileInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    const selected = list.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (selected.length === 0) {
      setError("Selecciona al menos un archivo PDF.");
      return;
    }
    await handleFiles(selected);
    // permite volver a seleccionar los mismos archivos
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFiles = async (files: File[]) => {
    if (!userRUC || !entityId || !userId) {
      setError("Faltan parámetros obligatorios para procesar los archivos.");
      return;
    }

    setLoading(true);
    setError("");
    const allEntries: JournalEntry[] = [];
    const ignored: string[] = [];

    for (const file of files) {
      try {
        const entries = await parsePDF(file, userRUC, entityId, userId);
        if (entries.length > 0) {
          allEntries.push(...entries);
          setProcessedFiles((prev) => [...prev, file.name]);
        } else {
          ignored.push(file.name);
        }
      } catch (err) {
        console.warn(`❌ Error procesando ${file.name}`, err);
        ignored.push(file.name);
      }
    }

    if (allEntries.length === 0) {
      setError("Ningún archivo nuevo fue procesado. Posiblemente ya fueron procesados antes.");
      setLoading(false);
      return;
    }

    setPreviewEntries(allEntries);
    setShowPreview(true);

    if (ignored.length > 0) {
      setError(`Se ignoraron archivos ya procesados: ${ignored.join(", ")}`);
    }

    setLoading(false);
  };

  const resetPreviewState = () => {
    setShowPreview(false);
    setPreviewEntries([]);
  };

  const handleConfirm = (confirmed: JournalEntry[]) => {
    onUploadComplete(confirmed, "preview-confirmed");
    resetPreviewState();
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed p-6 rounded text-center ${
        dragging ? "bg-blue-100" : "bg-white"
      }`}
    >
      <p className="mb-2">Arrastra tus PDFs aquí o usa el botón para seleccionar.</p>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
      >
        Seleccionar archivos
      </button>

      <input
        ref={fileInputRef}
        id="pdf-upload-input"
        type="file"
        accept=".pdf"
        multiple
        onChange={handleFileInput}
        className="hidden"
        title="Selecciona tus archivos PDF"
        placeholder="Selecciona tus archivos PDF"
      />

      {loading && <p className="mt-2 text-blue-600">Procesando archivos…</p>}
      {error && <p className="mt-2 whitespace-pre-line text-red-600">{error}</p>}

      {showPreview && (
        <JournalPreviewModal
          entries={previewEntries}
          accounts={accounts}
          entityId={entityId}
          userId={userId}
          onCancel={() => setShowPreview(false)}
          onSave={handleConfirm}
        />
      )}
    </div>
  );
}