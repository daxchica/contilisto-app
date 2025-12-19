// ============================================================================
// src/components/payables/RegisterPayablePaymentModal.tsx
// ---------------------------------------------------------------------------
// Register payable payment (Accounts Payable)
//
// FLOW (ACCOUNTING SAFE):
// 1) Create Bank Movement (Libro Bancos)  ← source of truth
// 2) Create Journal Entry derived from bank movement
// 3) Link Bank Movement → Journal transactionId
//
// USER-FACING (Spanish):
// - Registra un pago real desde el banco y genera el asiento contable.
// ============================================================================

import React, { useEffect, useState } from "react";
import { Rnd } from "react-rnd";

import type { Payable } from "@/types/Payable";
import { createPayablePaymentJournalEntry } from "@/services/journalService";
import {
  createBankMovement,
  linkJournalTransaction,
  type BankMovement,
} from "@/services/bankMovementService";

type Props = {
  isOpen: boolean;
  entityId: string;
  userId: string;
  payable: Payable | null;
  bankAccounts: { code: string; name: string }[]; // PUC bank accounts
  onClose: () => void;
  onSaved?: () => void;
};

export default function RegisterPayablePaymentModal({
  isOpen,
  entityId,
  userId,
  payable,
  bankAccounts,
  onClose,
  onSaved,
}: Props) {
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !payable) return;

    setAmount(payable.balance.toString());
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setBankAccount(bankAccounts[0]?.code ?? "");
    setError("");
  }, [isOpen, payable, bankAccounts]);

  if (!isOpen || !payable) return null;

  const p = payable;

  async function handleSave() {
    try {
      setSaving(true);
      setError("");

      const value = Number(amount);

      // ---------------------------
      // Validations (Spanish)
      // ---------------------------
      if (!entityId) throw new Error("Empresa no seleccionada");
      if (!userId) throw new Error("Usuario no válido");
      if (!p.id) throw new Error("Cuenta por pagar inválida");
      if (!paymentDate) throw new Error("Fecha requerida");
      if (!bankAccount) throw new Error("Cuenta bancaria requerida");
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Monto inválido");
      }
      if (value > p.balance) {
        throw new Error("El monto excede el saldo pendiente");
      }

      // =====================================================
      // 1) Create Bank Movement (Libro Bancos)
      // =====================================================
      const movement: BankMovement = {
        entityId,
        // TEMP: using account_code as identifier until real bankAccountId exists
        bankAccountId: bankAccount,
        date: paymentDate,
        amount: value, // normalized internally (negative for "out")
        type: "out",
        description: `Pago a proveedor ${p.supplierName ?? "Proveedor"} — Factura ${p.invoiceNumber}`,
        createdBy: userId,

        // Traceability (invoice reference by number)
        relatedInvoiceId: p.invoiceNumber,
      };

      const bankMovementId = await createBankMovement(movement);

      // =====================================================
      // 2) Create Journal Entry (derived from bank movement)
      // =====================================================
      const transactionId = await createPayablePaymentJournalEntry(
        entityId,
        p,
        value,
        paymentDate,
        bankAccount,
        userId,
        { bankMovementId }
      );

      // =====================================================
      // 3) Link Bank Movement → Journal transactionId
      // =====================================================
      await linkJournalTransaction(entityId, bankMovementId, transactionId);

      // Done
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo registrar el pago");
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
          {/* HEADER */}
          <div className="drag-header cursor-move px-6 py-4 border-b flex justify-between">
            <div>
              <h2 className="text-lg font-bold">Registrar pago</h2>
              <p className="text-xs text-gray-500">
                {p.supplierName} • Factura {p.invoiceNumber}
              </p>
            </div>
            <button onClick={onClose} disabled={saving}>
              ✕
            </button>
          </div>

          {/* BODY */}
          <div className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Monto a pagar</label>
              <input
                type="number"
                min={0.01}
                max={p.balance}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2 text-sm"
              />
              <div className="text-xs text-gray-500 mt-1">
                Saldo pendiente: ${p.balance.toFixed(2)}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Fecha de pago</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Cuenta bancaria</label>
              <select
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2 text-sm"
              >
                {bankAccounts.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
                {error}
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded text-sm"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Registrando..." : "Registrar pago"}
            </button>
          </div>
        </div>
      </Rnd>
    </div>
  );
}