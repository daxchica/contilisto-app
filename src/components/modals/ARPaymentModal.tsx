// ============================================================================
// src/components/modals/ARPaymentModal.tsx
// CONTILISTO — Accounts Receivable Payment Modal
// Supports Ecuador tax retentions
// ============================================================================

import React, { useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import type { JournalEntry } from "@/types/JournalEntry";
import type { Receivable } from "@/types/Receivable";
import type { Account } from "@/types/AccountTypes";

import { saveJournalEntries } from "@/services/journalService";
import { applyReceivablePayment } from "@/services/receivablesService";
import { saveRetention } from "@/services/retentionsService";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function parseDecimal(value: string): number {
  if (!value.trim()) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sanitizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function formatMoney(value?: number): string {
  return Number(value ?? 0).toFixed(2);
}

interface Props {
  entityId: string;
  userId: string;
  receivable: Receivable;
  accounts: Account[];
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ARPaymentModal({
  entityId,
  userId,
  receivable,
  accounts,
  onClose,
  onSuccess,
}: Props) {
  /* -------------------------------------------------------------------------- */
  /* STATE                                                                      */
  /* -------------------------------------------------------------------------- */

  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [retIR, setRetIR] = useState<string>("");
  const [retIVA, setRetIVA] = useState<string>("");

  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const [certificate, setCertificate] = useState("");
  const [loading, setLoading] = useState(false);
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [error, setError] = useState("");

  /* -------------------------------------------------------------------------- */
  /* DERIVED VALUES                                                             */
  /* -------------------------------------------------------------------------- */

  const invoiceBalance = Number(receivable.balance || receivable.total || 0);
  const invoiceTotal = Number(receivable.total || receivable.balance || 0);

  // Optional display fields — safe fallbacks in case Receivable does not include them
  const invoiceSubtotal =
    Number(
      (receivable as any).subtotal ??
        (receivable as any).taxableBase ??
        (receivable as any).baseAmount ??
        0
    ) || 0;

  const invoiceIVA =
    Number(
      (receivable as any).iva ??
        (receivable as any).ivaAmount ??
        (receivable as any).taxAmount ??
        0
    ) || 0;

  const paymentAmountNum = parseDecimal(paymentAmount);
  const retIRNum = parseDecimal(retIR);
  const retIVANum = parseDecimal(retIVA);

  const totalApplied =
    Number(paymentAmountNum || 0) +
    Number(retIRNum || 0) +
    Number(retIVANum || 0);

  // Positive means still pending. Negative means over-applied.
  const difference = invoiceBalance - totalApplied;

  const isOverApplied = difference < -0.009;
  const isPartial = totalApplied > 0 && totalApplied < invoiceBalance - 0.009;
  const isFull = Math.abs(difference) < 0.01;

  /* -------------------------------------------------------------------------- */
  /* ACCOUNT HELPERS                                                            */
  /* -------------------------------------------------------------------------- */

  const findAccount = (code: string) => accounts.find((a) => a.code === code);

  const bankAccounts = useMemo(() => {
    return accounts.filter(
      (a) => a.isBank === true || a.parentCode === "1010103"
    );
  }, [accounts]);

  const bankAccount = useMemo(() => {
    return bankAccounts.find((a) => a.code === bankAccountId);
  }, [bankAccounts, bankAccountId]);

  const arAccount = findAccount(receivable.account_code);
  const retIRAccount = findAccount("113020101");
  const retIVAAccount = findAccount("113020201");

  /* -------------------------------------------------------------------------- */
  /* CONFIRM PAYMENT                                                            */
  /* -------------------------------------------------------------------------- */

  const handleConfirm = async () => {
    setError("");

    if (paymentAmountNum < 0 || retIRNum < 0 || retIVANum < 0) {
      setError("Los valores no pueden ser negativos.");
      return;
    }

    if (totalApplied <= 0) {
      setError("El valor aplicado debe ser mayor que cero.");
      return;
    }

    if (isOverApplied) {
      setError("El valor aplicado excede el saldo pendiente de la factura.");
      return;
    }

    if (!bankAccountId) {
      setError("Debe seleccionar una cuenta bancaria.");
      return;
    }

    if (!bankAccount) {
      setError("La cuenta bancaria seleccionada no es válida.");
      return;
    }

    if (!bankAccount.code || !bankAccount.name) {
      setError("La cuenta bancaria seleccionada no tiene código o nombre contable.");
      return;
    }

    if (!arAccount?.code || !arAccount?.name) {
      setError(`No se encontró la cuenta contable ${receivable.account_code} para la factura.`);
      return;
    }

    if (retIRNum > 0 && (!retIRAccount?.code || !retIRAccount?.name)) {
      setError("Falta la cuenta contable de retención IR (113201).");
      return;
    }

    if (retIVANum > 0 && (!retIVAAccount?.code || !retIVAAccount?.name)) {
      setError("Falta la cuenta contable de retención IVA (113202).");
      return;
    }

    if ((retIRNum > 0 || retIVANum > 0) && !certificate.trim()) {
      setError("Debe ingresar el certificado de retención.");
      return;
    }

    try {
      setLoading(true);

      const transactionId = uuidv4();
      const entries: JournalEntry[] = [];

      /* ---------------- BANK DEBIT ---------------- */

      if (paymentAmountNum > 0) {
        entries.push({
          id: uuidv4(),
          entityId,
          account_code: String(bankAccount.code),
          account_name: String(bankAccount.name),
          debit: paymentAmountNum,
          credit: 0,
          date,
          transactionId,
          description: `Cobro cliente ${receivable.customerName ?? ""} Factura ${receivable.invoiceNumber}`,
        });
      }

      /* ---------------- IR RETENTION ---------------- */

      if (retIRNum > 0 && retIRAccount) {
        entries.push({
          id: uuidv4(),
          entityId,
          transactionId,
          date,
          account_code: String(retIRAccount.code),
          account_name: String(retIRAccount.name),
          debit: retIRNum,
          credit: 0,
          description: `Retención IR cliente ${receivable.customerName ?? ""} Cert ${certificate}`,
        });
      }

      /* ---------------- IVA RETENTION ---------------- */

      if (retIVANum > 0 && retIVAAccount) {
        entries.push({
          id: uuidv4(),
          entityId,
          transactionId,
          date,
          account_code: String(retIVAAccount.code),
          account_name: String(retIVAAccount.name),
          debit: retIVANum,
          credit: 0,
          description: `Retención IVA cliente ${receivable.customerName ?? ""} Cert ${certificate}`,
        });
      }

      /* ---------------- CREDIT AR ---------------- */

      entries.push({
        id: uuidv4(),
        entityId,
        account_code: String(arAccount.code),
        account_name: String(arAccount.name),
        debit: 0,
        credit: totalApplied,
        date,
        transactionId,
        description: `Cobro factura ${receivable.invoiceNumber}`,
      });

      /* ---------------- SAFETY CHECK ---------------- */

      const totalDebit = entries.reduce((sum, e) => sum + Number(e.debit ?? 0), 0);
      const totalCredit = entries.reduce((sum, e) => sum + Number(e.credit ?? 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error("El asiento contable no está balanceado.");
      }

      /* ---------------- SAVE JOURNAL ---------------- */

      await saveJournalEntries(entityId, userId, entries);

      /* ---------------- UPDATE RECEIVABLE ---------------- */

      await applyReceivablePayment(
        entityId,
        receivable,
        totalApplied,
        userId,
        transactionId
      );

      /* ---------------- SAVE RETENTION ---------------- */

      if (retIRNum > 0 || retIVANum > 0) {
        await saveRetention(entityId, {
          invoiceNumber: receivable.invoiceNumber,
          customerRUC: receivable.customerRUC,
          customerName: receivable.customerName,
          date,
          certificate,
          irRetention: retIR,
          ivaRetention: retIVA,
          transactionId,
          createdAt: new Date().toISOString(),
        });
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Error registrando el cobro.");
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* UI                                                                         */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[520px] p-6 space-y-4">
        <h2 className="text-lg font-semibold">Registrar Cobro</h2>

        <div className="text-sm text-gray-600">
          Factura No.: {receivable.invoiceNumber}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div>
            <div className="text-xs font-medium text-gray-500">Monto factura</div>
            <div className="text-lg font-semibold text-gray-900">
              ${formatMoney(invoiceTotal)}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-500">Base imponible</div>
            <div className="text-lg font-semibold text-gray-900">
              ${formatMoney(invoiceSubtotal)}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-500">IVA factura</div>
            <div className="text-lg font-semibold text-gray-900">
              ${formatMoney(invoiceIVA)}
            </div>
          </div>

          <div className="sm:col-span-3">
            <div className="text-xs font-medium text-gray-500">Saldo pendiente</div>
            <div className="text-xl font-bold text-gray-900">
              ${formatMoney(invoiceBalance)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Fecha de cobro</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Cuenta bancaria</label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="mt-1 w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
            >
              <option value="">-- Seleccione una cuenta --</option>

              {bankAccounts.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs">Pago Recibido</label>
            <input
              type="text"
              inputMode="decimal"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(sanitizeDecimalInput(e.target.value))}
              className="mt-1 w-full border-2 border-gray-400 rounded-lg px-3 py-2.5 text-base font-medium bg-white focus:outline-none focus:ring-blue-200 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs">IR Retención</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={retIR === "0" ? "" : retIR}
              onFocus={(e) => setRetIR(sanitizeDecimalInput(e.target.value))}
              className="mt-1 w-full border-2 border-gray-400 rounded-lg px-3 py-2.5 text-base font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-800">IVA Retención</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={retIVA === "0" ? "" : retIVA}
              onChange={(e) => setRetIVA(sanitizeDecimalInput(e.target.value))}
              className="mt-1 w-full border-2 border-gray-400 rounded-lg px-3 py-2.5 text-base font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
            />
          </div>

          <div className="col-span-2">
            <label className="text-sm font-medium text-gray-800">
              Certificado de Retención
            </label>
            <input
              value={certificate}
              onChange={(e) => setCertificate(e.target.value)}
              className="mt-1 w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              placeholder="Ingrese el número del certificado"
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Total Aplicado</span>
            <b className="text-gray-900">${formatMoney(totalApplied)}</b>
          </div>

          <div className="flex items-center justify-between mt-1">
            <span className="text-gray-600">Diferencia</span>
            <span className={isOverApplied ? "font-semibold text-red-600" : "font-semibold text-gray-900"}>
              ${formatMoney(difference)}
            </span>
          </div>

          <div className="flex items-center justify-between mt-1">
            <span className="text-gray-600">Saldo restante</span>
            <span className="font-semibold text-gray-900">
              ${formatMoney(Math.max(difference, 0))}
            </span>
          </div>

          {isPartial && (
            <div className="mt-2 text-amber-700 text-xs">
              Este cobro es parcial. La factura quedará con saldo pendiente.
            </div>
          )}

          {isFull && (
            <div className="mt-2 text-green-700 text-xs">
              Este cobro liquida completamente la factura.
            </div>
          )}

          {isOverApplied && (
            <div className="mt-2 text-red-700 text-xs">
              El valor aplicado excede el saldo pendiente de la factura.
            </div>
          )}
        </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

        <div className="flex justify-end gap-3 pt-4">
          <button 
            onClick={onClose} 
            className="px-4 py-2 border rounded text-sm"
            disabled={loading}
          >
            Cancelar
          </button>

          <button
            disabled={loading || totalApplied <= 0}
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? "Procesando..." : "Confirmar Cobro"}
          </button>
        </div>
      </div>
    </div>
  );
}