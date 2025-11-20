// ============================================================================
// src/components/PDFDropzone.tsx
// ARQUITECTURA CONTILISTO v1.0
// Dropzone profesional con validación estricta y tipado sin errores.
// ============================================================================

import React, { useRef, useState } from "react";

interface Props {
  disabled?: boolean;
  onFilesSelected: (files: FileList | null) => void | Promise<void>;
}

export default function PDFDropzone({ disabled, onFilesSelected }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // -------------------------------------------------------------------------
  // VALIDACIONES
  // -------------------------------------------------------------------------
  const MAX_SIZE_MB = 5;
  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

  function validateFiles(files: FileList | null): FileList | null {
    setErrorMessage("");

    if (!files || files.length === 0) return null;

    const file = files[0];

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMessage("Solo se permiten archivos PDF.");
      return null;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setErrorMessage(
        `El archivo es demasiado grande (${(file.size / 1024 / 1024).toFixed(
          2
        )} MB). Máximo permitido: ${MAX_SIZE_MB} MB.`
      );
      return null;
    }

    return files;
  }

  // -------------------------------------------------------------------------
  // DROP HANDLER
  // -------------------------------------------------------------------------
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    setIsDragging(false);

    const valid = validateFiles(e.dataTransfer.files);
    onFilesSelected(valid);
  };

  // -------------------------------------------------------------------------
  // CLICK HANDLER
  // -------------------------------------------------------------------------
  const handleClick = () => {
    if (!disabled) {
      setErrorMessage("");
      fileInputRef.current?.click();
    }
  };

  // -------------------------------------------------------------------------
  // DRAG EVENTS
  // -------------------------------------------------------------------------
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  return (
    <div className="w-full">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        className={`
          w-full border-2 border-dashed rounded-xl p-10 text-center transition
          ${
            disabled
              ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
              : isDragging
              ? "border-blue-500 bg-blue-100 cursor-pointer"
              : "border-blue-400 bg-blue-50/50 hover:bg-blue-100 cursor-pointer"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const valid = validateFiles(e.target.files);
            onFilesSelected(valid);
          }}
        />

        <div className="text-gray-700 flex flex-col items-center gap-2">
          <span className="text-5xl">📄</span>

          {disabled ? (
            <p className="text-gray-400 text-base">
              Selecciona una empresa para habilitar la carga de PDFs.
            </p>
          ) : (
            <>
              <p className="text-gray-700 font-semibold text-base">
                Arrastra tu factura PDF aquí
              </p>
              <p className="text-gray-600 text-sm">o haz clic para seleccionar</p>
            </>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="mt-2 text-red-600 font-medium text-sm">{errorMessage}</div>
      )}
    </div>
  );
}