import React, { useMemo, useState, useEffect } from "react";
import type { Account } from "@/types/AccountTypes";
import { createSubaccount } from "@/services/chartOfAccountsService";
import MovableModal from "@/components/ui/MovableModal";

interface Props {
  entityId: string;
  parentAccount: Account;
  existingAccounts: Account[];
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newAccount: Account) => void;
}

export default function CreateSubaccountModal({
  entityId,
  parentAccount,
  existingAccounts,
  isOpen,
  onClose,
  onCreated,
}: Props) {
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /* ------------------ NEXT CHILD CODE ------------------ */
  const nextChildCode = useMemo(() => {
    const children = existingAccounts.filter(
      a =>
        a.code.startsWith(parentAccount.code) &&
        a.code.length === parentAccount.code.length + 2
    );

    if (!children.length) return `${parentAccount.code}01`;

    const max = Math.max(...children.map(c => Number(c.code.slice(-2))));
    return `${parentAccount.code}${String(max + 1).padStart(2, "0")}`;
  }, [parentAccount, existingAccounts]);

  /* ------------------ Prefill on open ------------------ */
  useEffect(() => {
    if (isOpen) {
      setNewCode(nextChildCode);
      setNewName("");
      setError("");
    }
  }, [isOpen, nextChildCode]);

  const detectedLevel = parentAccount.level + 1;

  const isDuplicate = existingAccounts.some(a => a.code === newCode.trim());
  const isNumeric = /^\d+$/.test(newCode.trim());
  const matchesParent = newCode.trim().startsWith(parentAccount.code);
  const hasName = newName.trim().length > 2;

  const canSubmit =
    isNumeric &&
    matchesParent &&
    !isDuplicate &&
    hasName &&
    !saving;

  /* ------------------ SUBMIT ------------------ */
  const submitCreate = async () => {
    setError("");

    const code = newCode.trim();
    const name = newName.trim();

    if (!canSubmit) {
      setError("Revisa los datos antes de continuar.");
      return;
    }

    try {
      setSaving(true);

      await createSubaccount(entityId, {
        code,
        name,
        parentCode: parentAccount.code,
        level: detectedLevel,   // ✅ pass level only
      });

      const newAccount: Account = {
        code,
        name,
        level: detectedLevel,
      };

      onCreated(newAccount);
      onClose();
    } catch (err) {
      console.error(err);
      setError("Error al crear la subcuenta.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <MovableModal
      isOpen
      title={`Crear subcuenta de ${parentAccount.code}`}
      onClose={onClose}
    >
      <div className="space-y-4">

        <div className="bg-gray-100 p-3 rounded text-sm">
          <strong>Cuenta padre:</strong>{" "}
          {parentAccount.code} - {parentAccount.name}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Código
          </label>
          <input
            value={newCode}
            onChange={e => setNewCode(e.target.value)}
            className={`w-full border rounded px-3 py-2 ${
              isDuplicate || !matchesParent || !isNumeric
                ? "border-red-500"
                : "border-gray-300"
            }`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Nombre
          </label>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nombre de la subcuenta"
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>

        <div className="text-sm text-gray-600">
          Nivel detectado: <strong>{detectedLevel}</strong>
        </div>

        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}

        <div className="flex justify-end gap-3 pt-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={submitCreate}
            disabled={!canSubmit}
            className={`px-4 py-2 rounded-lg text-white ${
              canSubmit
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {saving ? "Creando..." : "Crear Subcuenta"}
          </button>
        </div>

      </div>
    </MovableModal>
  );
}