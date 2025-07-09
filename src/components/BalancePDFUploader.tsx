// components/BalancePDFUploader.tsx

import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { parseBalanceSheetPDF } from "../utils/pdfParser"; // you must implement this
import { BalanceEntry } from "../types";

interface Props {
  onUploadComplete: (entries: BalanceEntry[]) => void;
}

export default function BalancePDFUploader({ onUploadComplete }: Props) {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    const entries = await parseBalanceSheetPDF(file);
    onUploadComplete(entries);
  }, [onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] }
  });

  return (
    <div {...getRootProps()} className="border-2 border-dashed p-4 rounded text-center cursor-pointer hover:bg-gray-50">
      <input {...getInputProps()} />
      {isDragActive ? (
        <p>Depositar PDFs aqui...</p>
      ) : (
        <p>Arrastre y Deposite el PDF del Balance Inicial, o click para seleccionar</p>
      )}
    </div>
  );
}