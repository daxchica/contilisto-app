import { useState, DragEvent, ChangeEvent, useRef } from "react";
import { parsePDF } from "../services/journalService";
import JournalPreviewModal from "./JournalPreviewModal";

interface PDFUploaderProps {
  onUploadComplete: (entries: any[], source: string) => void;
  userRUC?: string;
  entityId: string;
  userId: string;
}

export default function PDFUploader({
  userRUC,
  entityId,
  userId,
  onUploadComplete,
}: PDFUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewEntries, setPreviewEntries] = useState<any[]>([]);
  const [processedFiles, setProcessedFiles] = useState<string[]>([]);

   // 🧷 Declarar el ref correctamente
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".pdf"));
    await handleFiles(dropped);
  };

  const handleFileInput = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter(f => f.name.endsWith(".pdf"));
      await handleFiles(selected);
    }
  };

  const handleFiles = async (files: File[]) => {
    if (!userRUC || !entityId || !userId) {
      setError("Faltan parámetros obligatorios para procesar los archivos.");
      return;
    }

    setLoading(true);
    setError("");
    const allEntries: any[] = [];
    const ignored: string[] = [];

    for (const file of files) {
      try {
        const entries = await parsePDF(file, userRUC, entityId, userId);
        if (entries.length > 0) {
          allEntries.push(...entries);
          setProcessedFiles(prev => [...prev, file.name]);
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

  const handleConfirm = (confirmed: any[]) => {
    onUploadComplete(confirmed, "preview-confirmed");
    setShowPreview(false);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed p-6 rounded text-center ${dragging ? "bg-blue-100" : "bg-white"}`}
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
        placeholder="Selecciona tus archivo PDF" 
      />

      {loading && <p className="mt-2 text-blue-600">Procesando archivos…</p>}
      {error && <p className="mt-2 text-red-600 whitespace-pre-line">{error}</p>}
      {showPreview && (
        <JournalPreviewModal
          entries={previewEntries}
          onCancel={() => setShowPreview(false)}
          onSave={handleConfirm}
        />
      )}
    </div>
  );
}