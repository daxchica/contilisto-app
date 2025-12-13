// src/components/DeleteEntityModal.tsx

import React, { useState } from "react";

interface DeleteEntityModalProps {
  entityName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteEntityModal({
  entityName,
  onCancel,
  onConfirm,
}: DeleteEntityModalProps) {
  const [confirmInput, setConfirmInput] = useState("");

  const isMatch = confirmInput.trim() === entityName.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-red-600">¿Eliminar entidad?</h2>
        <p className="mb-2">
          Estás por eliminar: <strong>{entityName}</strong>
        </p>
        <p className="mb-4 text-sm text-gray-600">
          Escribe el nombre exacto de la entidad para confirmar:
        </p>
        <input
          type="text"
          className="border px-3 py-2 w-full rounded mb-4"
          placeholder="Nombre exacto de la entidad"
          value={confirmInput}
          onChange={(e) => setConfirmInput(e.target.value)}
        />
        <div className="flex justify-end gap-4">
          <button
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className={`px-4 py-2 text-white rounded ${
              isMatch ? "bg-red-600 hover:bg-red-700" : "bg-red-300 cursor-not-allowed"
            }`}
            disabled={!isMatch}
            onClick={onConfirm}
          >
            Confirmar Eliminación
          </button>
        </div>
      </div>
    </div>
  );
}