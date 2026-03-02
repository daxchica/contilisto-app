// ============================================================================
// Register payable payment (Accounts Payable)
// ACCOUNTING SAFE FLOW:
// 1) Bank Movement
// 2) Journal Entry
// 3) Link Bank → Journal
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { Rnd } from "react-rnd";

import type { Payable } from "@/types/Payable";
import type { BankAccount } from "@/types/bankTypes";

import {
  createBankMovement,
  linkJournalTransaction,
  type BankMovement,
} from "@/services/bankMovementService";

import { createPayablePaymentJournalEntry } from "@/services/journalService";
import { repairPayableAccountFromJournal } from "@/services/payablesService";
import { normalizeAccountCode } from "@/utils/normalizeAccountCode";

type Props = {
  isOpen: boolean;
  entityId: string;
  userIdSafe: string;
  payable: Payable | null;
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
  return normalizeAccountCode(bank as any);
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function RegisterPayablePaymentModal({
  isOpen,
  entityId,
  userIdSafe,
  payable,
  bankAccounts,
  onClose,
  onSaved,
}: Props) {
  const [localPayable, setLocalPayable] = useState<Payable | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [needsRepair, setNeedsRepair] = useState(false);
  const [repairing, setRepairing] = useState(false);

  // --------------------------------------------------
  // Init on open
  // --------------------------------------------------
  useEffect(() => {
    if (!isOpen || !payable) return;

    setLocalPayable(payable);
    setAmount(payable.balance.toString());
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setBankAccountId(bankAccounts.length === 1 ? bankAccounts[0]?.id! : "");
    setError("");
    setNeedsRepair(false);
  }, [isOpen, payable, bankAccounts]);

  // --------------------------------------------------
  // Selected bank
  // --------------------------------------------------
  const selectedBank = useMemo(
    () => bankAccounts.find((b) => b.id === bankAccountId),
    [bankAccounts, bankAccountId]
  );

  const numericAmount = useMemo(() => toNumber(amount), [amount]);

  if (!isOpen || !localPayable) return null;
  const p = localPayable;

  // --------------------------------------------------
  // Save handler
  // --------------------------------------------------
  async function handleSave() {
    try {
      setSaving(true);
      setError("");
      setNeedsRepair(false);

      if (!entityId) throw new Error("Empresa no seleccionada");
      if (!userIdSafe) throw new Error("Usuario no válido");
      if (!p.id) throw new Error("Cuenta por pagar inválida");
      if (!paymentDate) throw new Error("Fecha requerida");
      if (!selectedBank) throw new Error("Cuenta bancaria requerida");

      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error("Monto inválido");
      }

      if (numericAmount > p.balance) {
        throw new Error("El monto excede el saldo pendiente");
      }

      // ✅ CRITICAL FIX:
      // Prevent orphan bank movements by validating payable BEFORE creating movement.
      // If payable lacks supplier account_code, we must repair first.
      if (!p.account_code || !String(p.account_code).trim()) {
        setNeedsRepair(true);
        throw new Error(
          "El payable no tiene cuenta contable de proveedores. Debe repararse antes de pagar."
        );
      }

      // ✅ The Journal must credit the BANK GL ACCOUNT CODE, not necessarily the bankAccountId.
      const bankGLCode = resolveBankGLCode(selectedBank);
      if (!bankGLCode) {
        throw new Error("La cuenta bancaria no tiene código contable (GL).");
      }

      // =====================================================
      // 1) Bank Movement
      // =====================================================
      const movement: BankMovement = {   
        entityId,
        bankAccountId: selectedBank.id!,
        date: paymentDate,
        amount: numericAmount,
        type: "out",
        description: `Pago a proveedor ${p.supplierName ?? "Proveedor"} — Factura ${p.invoiceNumber}`,
        createdBy: userIdSafe,
        reconciled: false,
      };

      const bankMovementId = await createBankMovement(movement);

      // =====================================================
      // 2) Journal Entry (may fail if payable is broken)
      // =====================================================
      const transactionId = await createPayablePaymentJournalEntry(
        entityId,
        p,
        numericAmount,
        paymentDate,
        {
          id: selectedBank.id!,
          account_code: bankGLCode,
          name: selectedBank.name,
        },
        userIdSafe,
        { bankMovementId }
      );

      // =====================================================
      // 3) Link bank → journal
      // =====================================================
      await linkJournalTransaction(entityId, bankMovementId, transactionId);

      onSaved?.();
      onClose();
    } catch (e: any) {
      const msg = e?.message ?? "No se pudo registrar el pago";
      setError(msg);

      // 🔴 Explicit invariant detection
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
  // Repair handler (deterministic)
  // --------------------------------------------------
  async function handleRepair() {
  try {
    setRepairing(true);
    setError("");

    if (!p.id) {
      throw new Error("Payable inválido: falta identificador");
    }

    const picked = await repairPayableAccountFromJournal(entityId, p.id);

    setLocalPayable((prev) =>
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
      "Cuenta contable reparada correctamente. Ahora puede registrar el pago."
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
              <h2 className="text-lg font-bold">Registrar pago</h2>
              <p className="text-xs text-gray-500">
                {p.supplierName} • Factura {p.invoiceNumber}
              </p>
            </div>
            <button onClick={onClose} disabled={saving}>✕</button>
          </div>

          {/* BODY */}
          <div className="p-6 space-y-4">
            {/* AMOUNT */}
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

            {/* DATE */}
            <div>
              <label className="text-sm font-medium">Fecha de pago</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            {/* BANK */}
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
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>

              {selectedBank && (
                <div className="text-xs text-gray-500 mt-1">
                  Se debitará de: <strong>{selectedBank.name}</strong>
                </div>
              )}
            </div>

            {/* ERROR */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
                {error}
              </div>
            )}

            {/* REPAIR CTA */}
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
              {saving ? "Registrando..." : "Registrar pago"}
            </button>
          </div>
        </div>
      </Rnd>
    </div>
  );
}
