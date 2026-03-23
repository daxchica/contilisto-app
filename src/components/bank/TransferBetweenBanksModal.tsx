// ============================================================================
// TransferBetweenBanksModal.tsx
// Creates safe inter-bank transfer (2 movements + 1 journal)
// ============================================================================

import React, { useState } from "react";
import { Rnd } from "react-rnd";

import { createInterBankTransfer, linkJournalTransactionByTransferId } from "@/services/bankMovementService";
import { createTransferJournalEntry } from "@/services/journalService";

type BankAccount = {
  id?: string;
  code: string;
  name: string;
};

type Props = {
  isOpen: boolean;
  entityId: string;
  userIdSafe: string;
  bankAccounts: BankAccount[];
  onClose: () => void;
  onSaved?: () => void;
};

export default function TransferBetweenBanksModal({
  isOpen,
  entityId,
  userIdSafe,
  bankAccounts,
  onClose,
  onSaved,
}: Props) {
  const [fromBankCode, setFromBankCode] = useState("");
  const [toBankCode, setToBankCode] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSave() {
    try {
      setSaving(true);
      setError("");

      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error("Monto inválido");
      }

      if (!fromBankCode || !toBankCode) {
        throw new Error("Seleccione ambas cuentas");
      }

      const fromBank = bankAccounts.find((b) => b.code === fromBankCode);
      const toBank = bankAccounts.find((b) => b.code === toBankCode);

      if (!fromBank || !toBank) {
        throw new Error("Cuenta bancaria inválida");
      }

      const { transferId } = await createInterBankTransfer({
        entityId,
        date,
        amount: numericAmount,
        fromBankAccountId: fromBankCode,
        toBankAccountId: toBankCode,
        fromAccountCode: fromBank.code,
        toAccountCode: toBank.code,
        description: "Transferencia entre bancos",
        createdBy: userIdSafe,
      });

      const transactionId = await createTransferJournalEntry(
        entityId,
        fromBank.code,
        toBank.code,
        numericAmount,
        date,
        userIdSafe,
        fromBank.name,
        toBank.name
      );

      await linkJournalTransactionByTransferId(
        entityId,
        transferId,
        transactionId
      );

      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Error al transferir");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Rnd
        default={{
          x: window.innerWidth / 2 - 300,
          y: window.innerHeight / 2 - 220,
          width: 600,
          height: "auto",
        }}
        enableResizing={false}
        dragHandleClassName="drag-header"
        bounds="window"
      >
        <div className="bg-white rounded-xl shadow-xl w-full">
          <div className="drag-header cursor-move px-6 py-4 border-b flex justify-between">
            <h2 className="text-lg font-bold">Transferencia entre bancos</h2>
            <button onClick={onClose}>✕</button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label>Cuenta Origen</label>
              <select
                className="w-full border p-2 rounded"
                value={fromBankCode}
                onChange={(e) => setFromBankCode(e.target.value)}
              >
                <option value="">Seleccione...</option>
                {bankAccounts.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Cuenta Destino</label>
              <select
                className="w-full border p-2 rounded"
                value={toBankCode}
                onChange={(e) => setToBankCode(e.target.value)}
              >
                <option value="">Seleccione...</option>
                {bankAccounts.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Monto</label>
              <input
                type="number"
                className="w-full border p-2 rounded"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div>
              <label>Fecha</label>
              <input
                type="date"
                className="w-full border p-2 rounded"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}
          </div>

          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <button onClick={onClose} className="border px-4 py-2 rounded">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="bg-purple-600 text-white px-4 py-2 rounded"
              disabled={saving}
            >
              {saving ? "Procesando..." : "Transferir"}
            </button>
          </div>
        </div>
      </Rnd>
    </div>
  );
}
