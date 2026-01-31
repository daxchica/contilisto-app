// ============================================================================
// Register receivable collection (Accounts Receivable)
// ACCOUNTING SAFE FLOW:
// 1) Bank Movement
// 2) Journal Entry
// 3) Link Bank → Journal
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { Rnd } from "react-rnd";

import type { Receivable } from "@/types/Receivable";
import type { BankAccount } from "@/types/bankTypes";

import {
  createBankMovement,
  linkJournalTransaction,
  type BankMovement,
} from "@/services/bankMovementService";

import { createReceivableCollectionJournalEntry } from "@/services/journalService";
import { repairReceivableAccountFromJournal } from "@/services/receivablesService";

type Props = {
  isOpen: boolean;
  entityId: string;
  userId: string;
  receivable: Receivable | null;
  bankAccounts: BankAccount[];
  onClose: () => void;
  onSaved?: () => void;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function resolveBankGLCode(bank: BankAccount): string {
  const b = bank as any;
  return (
    b.account_code ||
    b.accountCode ||
    b.glAccountCode ||
    b.glAccount ||
    b.code ||
    ""
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function RegisterReceivableCollectionModal({
  isOpen,
  entityId,
  userId,
  receivable,
  bankAccounts,
  onClose,
  onSaved,
}: Props) {
  const [localReceivable, setLocalReceivable] =
    useState<Receivable | null>(null);
  const [amount, setAmount] = useState("");
  const [collectionDate, setCollectionDate] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [needsRepair, setNeedsRepair] = useState(false);
  const [repairing, setRepairing] = useState(false);

  // --------------------------------------------------
  // Init on open
  // --------------------------------------------------
  useEffect(() => {
    if (!isOpen || !receivable) return;

    setLocalReceivable(receivable);
    setAmount(receivable.balance.toString());
    setCollectionDate(new Date().toISOString().slice(0, 10));
    setBankAccountId(bankAccounts.length === 1 ? bankAccounts[0]?.id! : "");
    setError("");
    setNeedsRepair(false);
  }, [isOpen, receivable, bankAccounts]);

  // --------------------------------------------------
  // Selected bank
  // --------------------------------------------------
  const selectedBank = useMemo(
    () => bankAccounts.find((b) => b.id === bankAccountId),
    [bankAccounts, bankAccountId]
  );

  const numericAmount = useMemo(() => toNumber(amount), [amount]);

  if (!isOpen || !localReceivable) return null;
  const r = localReceivable;

  // --------------------------------------------------
  // Save handler
  // --------------------------------------------------
  async function handleSave() {
    try {
      setSaving(true);
      setError("");
      setNeedsRepair(false);

      if (!entityId) throw new Error("Empresa no seleccionada");
      if (!userId) throw new Error("Usuario no válido");
      if (!r.id) throw new Error("Cuenta por cobrar inválida");
      if (!collectionDate) throw new Error("Fecha requerida");
      if (!selectedBank) throw new Error("Cuenta bancaria requerida");

      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error("Monto inválido");
      }

      if (numericAmount > r.balance) {
        throw new Error("El monto excede el saldo pendiente");
      }

      // ✅ Prevent orphan bank movements
      if (!r.account_code || !String(r.account_code).trim()) {
        setNeedsRepair(true);
        throw new Error(
          "El receivable no tiene cuenta contable de clientes. Debe repararse antes de cobrar."
        );
      }

      const bankGLCode = resolveBankGLCode(selectedBank);
      if (!bankGLCode) {
        throw new Error("La cuenta bancaria no tiene código contable (GL).");
      }

      // =====================================================
      // 1) Bank Movement (IN)
      // =====================================================
      const movement: BankMovement = {
        entityId,
        bankAccountId: selectedBank.id!,
        date: collectionDate,
        amount: numericAmount,
        type: "in",
        description: `Cobro a cliente ${r.customerName ?? "Cliente"} — Factura ${r.invoiceNumber}`,
        createdBy: userId,
      };

      const bankMovementId = await createBankMovement(movement);

      // =====================================================
      // 2) Journal Entry
      // =====================================================
      const transactionId = await createReceivableCollectionJournalEntry(
        entityId,
        r,
        numericAmount,
        collectionDate,
        {
          id: selectedBank.id!,
          account_code: bankGLCode,
          name: selectedBank.name,
        },
        userId,
        { bankMovementId }
      );

      // =====================================================
      // 3) Link bank → journal
      // =====================================================
      await linkJournalTransaction(entityId, bankMovementId, transactionId);

      onSaved?.();
      onClose();
    } catch (e: any) {
      const msg = e?.message ?? "No se pudo registrar el cobro";
      setError(msg);

      if (
        /sin cuenta contable/i.test(msg) ||
        /debe repararse/i.test(msg) ||
        /no tiene cuenta contable/i.test(msg)
      ) {
        setNeedsRepair(true);
      }
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // Repair handler
  // --------------------------------------------------
  async function handleRepair() {
    try {
      setRepairing(true);
      setError("");

      if (!r.id) {
        throw new Error("Receivable inválido: falta identificador");
      }

      const picked = await repairReceivableAccountFromJournal(entityId, r.id);

      setLocalReceivable((prev) =>
        prev
          ? {
              ...prev,
              account_code: picked.account_code,
              account_name: picked.account_name,
            }
          : prev
      );

      setNeedsRepair(false);
      setError(
        "Cuenta contable reparada correctamente. Ahora puede registrar el cobro."
      );

      onSaved?.();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo reparar la cuenta contable");
      setNeedsRepair(true);
    } finally {
      setRepairing(false);
    }
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
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
              <h2 className="text-lg font-bold">Registrar cobro</h2>
              <p className="text-xs text-gray-500">
                {r.customerName} • Factura {r.invoiceNumber}
              </p>
            </div>
            <button onClick={onClose} disabled={saving}>✕</button>
          </div>

          {/* BODY */}
          <div className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Monto a cobrar</label>
              <input
                type="number"
                min={0.01}
                max={r.balance}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2 text-sm"
              />
              <div className="text-xs text-gray-500 mt-1">
                Saldo pendiente: ${r.balance.toFixed(2)}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Fecha de cobro</label>
              <input
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Cuenta bancaria</label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">-- Seleccione una cuenta --</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.number})
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
                {error}
              </div>
            )}

            {needsRepair && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-sm text-yellow-800 mb-2">
                  Esta factura fue creada sin cuenta contable.
                </p>
                <button
                  onClick={handleRepair}
                  disabled={repairing}
                  className="px-3 py-2 bg-yellow-600 text-white rounded text-sm"
                >
                  {repairing ? "Reparando..." : "🛠 Reparar cuenta contable"}
                </button>
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
              {saving ? "Registrando..." : "Registrar cobro"}
            </button>
          </div>
        </div>
      </Rnd>
    </div>
  );
}