// ============================================================================
// src/components/modals/ARPaymentModal.tsx
// CONTILISTO — Accounts Receivable Payment Modal
// Supports Ecuador tax retentions
// ============================================================================

import React, { useState, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";

import type { JournalEntry } from "@/types/JournalEntry";
import type { Receivable } from "@/types/Receivable";
import type { Account } from "@/types/AccountTypes";

import { saveJournalEntries } from "@/services/journalService";
import { applyReceivablePayment } from "@/services/receivablesService";

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

  /* -------------------------------------------------------------------------- */
  /* DERIVED VALUES                                                             */
  /* -------------------------------------------------------------------------- */

  const totalApplied = useMemo(() => {
    return paymentAmount + retIR + retIVA;
  }, [paymentAmount, retIR, retIVA]);

  const difference = useMemo(() => {
    return (receivable.balance || receivable.total) - totalApplied;
  }, [receivable, totalApplied]);

  const balanced = Math.abs(difference) < 0.01;

  /* -------------------------------------------------------------------------- */
  /* ACCOUNT HELPERS                                                            */
  /* -------------------------------------------------------------------------- */

  const findAccount = (code: string) =>
    accounts.find((a) => a.code === code);

  const bankAccount = findAccount("110101");
  const arAccount = findAccount("120101");
  const retIRAccount = findAccount("113201");
  const retIVAAccount = findAccount("113202");

  /* -------------------------------------------------------------------------- */
  /* CONFIRM PAYMENT                                                            */
  /* -------------------------------------------------------------------------- */

  const handleConfirm = async () => {
    if (!balanced) {
      alert("The payment is not balanced with the invoice.");
      return;
    }

    if (!bankAccount || !arAccount) {
      alert("Required accounting accounts are missing.");
      return;
    }

    try {
      setLoading(true);

      const transactionId = uuidv4();

      const entries: JournalEntry[] = [];

      /* BANK */

      if (paymentAmount > 0) {
        entries.push({
          id: uuidv4(),
          entityId,
          account_code: bankAccount.code,
          account_name: bankAccount.name,
          debit: paymentAmount,
          credit: 0,
          date,
          transactionId,
          description: `Customer payment ${receivable.invoiceNumber}`,
        });
      }

      /* IR RETENTION RECEIVABLE */

      if (retIR > 0 && retIRAccount) {
        entries.push({
          id: uuidv4(),
          entityId,
          transactionId,
          date,
          account_code: retIRAccount.code,
          account_name: retIRAccount.name,
          debit: retIR,
          credit: 0,
          description: `IR retention ${certificate}`,
        });
      }

      /* IVA RETENTION RECEIVABLE */

      if (retIVA > 0 && retIVAAccount) {
        entries.push({
          id: uuidv4(),
          entityId,
          account_code: retIVAAccount.code,
          account_name: retIVAAccount.name,
          debit: retIVA,
          credit: 0,
          date,
          transactionId,
          description: `IVA retention ${certificate}`,
        });
      }

      /* CREDIT ACCOUNTS RECEIVABLE */

      entries.push({
        id: uuidv4(),
        entityId,
        account_code: arAccount.code,
        account_name: arAccount.name,
        debit: 0,
        credit: totalApplied,
        date,
        transactionId,
        description: `Invoice payment ${receivable.invoiceNumber}`,
      });

      /* SAVE JOURNAL */

      await saveJournalEntries(entityId, userId, entries );

      /* UPDATE RECEIVABLE */

      await applyReceivablePayment(
        entityId,
        receivable,
        totalApplied,
        userId,
        transactionId,
      );

      if (onSuccess) onSuccess();

      onClose();
    } catch (err) {
      console.error(err);
      alert("Error registering payment.");
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

        <h2 className="text-lg font-semibold">
          Register Customer Payment
        </h2>

        <div className="text-sm text-gray-600">
          Invoice: {receivable.invoiceNumber}
        </div>

        <div className="grid grid-cols-2 gap-3">

          <div>
            <label className="text-xs">Invoice Balance</label>
            <input
              value={receivable.balance}
              readOnly
              className="input"
            />
          </div>

          <div>
            <label className="text-xs">Payment Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="text-xs">Cash Received</label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) =>
                setPaymentAmount(Number(e.target.value))
              }
              className="input"
            />
          </div>

          <div>
            <label className="text-xs">IR Retention</label>
            <input
              type="number"
              value={retIR}
              onChange={(e) => setRetIR(Number(e.target.value))}
              className="input"
            />
          </div>

          <div>
            <label className="text-xs">IVA Retention</label>
            <input
              type="number"
              value={retIVA}
              onChange={(e) => setRetIVA(Number(e.target.value))}
              className="input"
            />
          </div>

          <div>
            <label className="text-xs">Retention Certificate</label>
            <input
              value={certificate}
              onChange={(e) => setCertificate(e.target.value)}
              className="input"
            />
          </div>

        </div>

        <div className="text-sm mt-3">

          <div>
            Total Applied:{" "}
            <b>${totalApplied.toFixed(2)}</b>
          </div>

          <div
            className={
              balanced ? "text-green-600" : "text-red-600"
            }
          >
            Difference: {difference.toFixed(2)}
          </div>

        </div>

        <div className="flex justify-end gap-3 pt-4">

          <button
            onClick={onClose}
            className="px-4 py-2 border rounded"
          >
            Cancel
          </button>

          <button
            disabled={!balanced || loading}
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            {loading ? "Processing..." : "Confirm Payment"}
          </button>

        </div>

      </div>
    </div>
  );
}