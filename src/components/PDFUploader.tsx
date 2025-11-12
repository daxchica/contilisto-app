// ARCHIVO: src/components/PDFUploader.tsx

import { useState, useEffect, DragEvent, ChangeEvent, useRef } from "react";
import { parsePDF } from "../services/journalService";
import JournalPreviewModal from "./JournalPreviewModal";
import type { JournalEntry } from "../types/JournalEntry";
import type { Account } from "../types/AccountTypes";

interface PDFUploaderProps {
  onUploadComplete: (entries: JournalEntry[]) => void;
  userRUC?: string;
  entityId: string;
  userId: string;
  accounts: Account[];
  entityType: string;
}

export default function PDFUploader({
  userRUC,
  entityId,
  userId,
  entityType,
  onUploadComplete,
}: PDFUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) => 
      f.name.toLowerCase().endsWith(".pdf")
  );
  if (dropped.length === 0) {
    setError("solo se aceptan archivos PDF.");
    return;
  }
  await handleFiles(dropped);
};

const handleFileInput = async (e: ChangeEvent<HTMLInputElement>) => {
  const selected = Array.from(e.target.files || []).filter((f) => 
    f.name.toLowerCase().endsWith(".pdf")
  );
  if (selected.length === 0) {
    setError("Selecciona al menos un archivo PDF.");
    return;
  }
  await handleFiles(selected);
  if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFiles = async (files: File[]) => {
    if (!userRUC || !entityId || !userId || !entityType) {
      setError("Faltan parametros obligatorios para procesar los archivos");
      return;
  }

  setLoading(true);
  setError("");
  setSuccessMessage("");

  const allEntries: JournalEntry[] = [];
  const processedFiles: string[] = [];
  const ignoredFiles: string[] = [];

  for (const file of files) {
    try {
      console.log(`Procesando archivo: ${file.name}`);
      const entries = await parsePDF(file, userRUC, entityId, userId, entityType);

      if (entries.length > 0) {
        allEntries.push(...entries);
        processedFiles.push(file.name);
      } else {
        ignoredFiles.push(file.name);
      }
    } catch (err) {
      console.error(`Error procesando ${file.name}:`, err);
      ignoredFiles.push(file.name);
    }
  }

  setLoading(false);

  // Simplificado - solo pasar entradas al padre
  if (allEntries.length > 0) {
    setSuccessMessage(`${allEntries.length} asientos extraidos de ${processedFiles.length} archivo(s)`);
    onUploadComplete(allEntries);
  } else {
    console.warn("Ningun asiento nuevo detectado, pero se permitira re-procesar en modo DEV.");
    setSuccessMessage("Modo DEV: revision forzada habilitada para archivos previos o vacios");
    onUploadComplete([]);
  }
  if (ignoredFiles.length > 0) {
    console.log(`Archivos ignorados: ${ignoredFiles.join(", ")}`);
    }
  };
  

  const handleSelectClick = () => {
    fileInputRef.current?.click();
  };

  useEffect(() => {
    if (successMessage || error) {
      const timeout = setTimeout(() => {
        setSuccessMessage("");
        setError("");
      }, 6000);
      return () => clearTimeout(timeout);
    }
  }, [successMessage, error]);

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
      <p className="mb-2">
        Arrastra tus PDFs aquí o usa el botón para seleccionar.
      </p>

      <button
        type="button"
        onClick={handleSelectClick}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
      >
        {loading ? " Procesando..." : "Seleccionar archivos"}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        onChange={handleFileInput}
        className="hidden"
        title="Selecciona tus archivos PDF"
        disabled={loading}
        placeholder="Selecciona tus archivos PDF"
      />

      {loading && (
        <p className="mt-2 text-blue-600">
          ⏳ Extrayendo datos de facturas con IA...
        </p>
      )}

      {successMessage && (
        <p className="mt-2 text-green-700 font-medium">{successMessage}</p>
      )}

      {error && (
        <p className="mt-2 whitespace-pre-line text-red-600 font-medium">{error}</p>
      )}
    </div>
  );
}