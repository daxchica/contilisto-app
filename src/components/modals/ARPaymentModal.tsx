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

  const [paymentAmount, setPaymentAmount] = useState<number>(
    receivable.balance || receivable.total
  );

  const [retIR, setRetIR] = useState<number>(0);
  const [retIVA, setRetIVA] = useState<number>(0);

  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const [certificate, setCertificate] = useState("");
  const [loading, setLoading] = useState(false);
  const [bankAccountId, setBankAccountId] = useState("");
  const [error, setError] = useState("");

  /* -------------------------------------------------------------------------- */
  /* DERIVED VALUES                                                             */
  /* -------------------------------------------------------------------------- */

  const invoiceBalance = Number(receivable.balance || receivable.total || 0);
  const totalApplied = Number(paymentAmount || 0) + Number(retIR || 0) + Number(retIVA || 0);
  const difference = invoiceBalance - totalApplied;
  const balanced = Math.abs(difference) < 0.01;

  /* -------------------------------------------------------------------------- */
  /* ACCOUNT HELPERS                                                            */
  /* -------------------------------------------------------------------------- */

  const findAccount = (code: string) =>
    accounts.find((a) => a.code === code);

  // Adjust this filter if your bank accounts use a different coding pattern.
  // For now it includes common asset/bank account prefixes.
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

    if (paymentAmount < 0 || retIR < 0 || retIVA < 0) {
      setError("Los valores no pueden ser negativos.");
      return;
    }

    if (totalApplied <= 0) {
      setError("El valor aplicado debe ser mayor que cero.");
      return;
    }

    if (!balanced) {
      setError("El cobro no está balanceado contra la factura.");
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

    if (retIR > 0 && (!retIRAccount?.code || !retIRAccount?.name)) {
      setError("Falta la cuenta contable de retención IR (113201).");
      return;
    }

    if (retIVA > 0 && (!retIVAAccount?.code || !retIVAAccount?.name)) {
      setError("Falta la cuenta contable de retención IVA (113202).");
      return;
    }

    if ((retIR > 0 || retIVA > 0) && !certificate.trim()) {
      setError("Debe ingresar el certificado de retención.");
      return;
    }

    try {
      setLoading(true);

      const transactionId = uuidv4();
      const entries: JournalEntry[] = [];

      /* ---------------- BANK DEBIT ---------------- */

      if (paymentAmount > 0) {
        entries.push({
          id: uuidv4(),
          entityId,
          account_code: String(bankAccount.code),
          account_name: String(bankAccount.name),
          debit: paymentAmount,
          credit: 0,
          date,
          transactionId,
          description: `Cobro cliente ${receivable.customerName ?? ""} Factura ${receivable.invoiceNumber}`,
        });
      }

      /* ---------------- IR RETENTION ---------------- */

      if (retIR > 0 && retIRAccount) {
        entries.push({
          id: uuidv4(),
          entityId,
          transactionId,
          date,
          account_code: String(retIRAccount.code),
          account_name: String(retIRAccount.name),
          debit: retIR,
          credit: 0,
          description: `Retención IR cliente ${receivable.customerName ?? ""} Cert ${certificate}`,
        });
      }

      /* ---------------- IVA RETENTION ---------------- */

      if (retIVA > 0 && retIVAAccount) {
        entries.push({
          id: uuidv4(),
          entityId,
          transactionId,
          date,
          account_code: String(retIVAAccount.code),
          account_name: String(retIVAAccount.name),
          debit: retIVA,
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

      if (retIR > 0 || retIVA > 0) {
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
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
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
            <label className="text-xs">Saldo de Factura</label>
            <input value={invoiceBalance} readOnly className="input" />
          </div>

          <div>
            <label className="text-xs">Pago Recibido</label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
              className="input"
            />
          </div>

          <div>
            <label className="text-xs">IR Retención</label>
            <input
              type="number"
              value={retIR}
              onChange={(e) => setRetIR(parseFloat(e.target.value) || 0)}
              className="input"
            />
          </div>

          <div>
            <label className="text-xs">IVA Retención</label>
            <input
              type="number"
              value={retIVA}
              onChange={(e) => setRetIVA(parseFloat(e.target.value) || 0)}
              className="input"
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs">Certificado de Retención</label>
            <input
              value={certificate}
              onChange={(e) => setCertificate(e.target.value)}
              className="input w-full"
            />
          </div>
        </div>

        <div className="text-sm mt-3">
          <div>
            Total Aplicado: <b>${totalApplied.toFixed(2)}</b>
          </div>

          <div className={balanced ? "text-green-600" : "text-red-600"}>
            Diferencia: {difference.toFixed(2)}
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button onClick={onClose} className="px-4 py-2 border rounded">
            Cancelar
          </button>

          <button
            disabled={!balanced || loading || totalApplied <= 0}
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