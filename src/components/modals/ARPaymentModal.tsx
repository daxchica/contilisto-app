// ============================================================================
// src/components/modals/ARPaymentModal.tsx
// CONTILISTO — Accounts Receivable Payment Modal (FINAL FIXED)
// ============================================================================

import React, { useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import type { JournalEntry } from "@/types/JournalEntry";
import type { Receivable } from "@/types/Receivable";
import type { Account } from "@/types/AccountTypes";

import { saveJournalEntries } from "@/services/journalService";
import { applyReceivablePayment } from "@/services/receivablesService";
import { saveRetention } from "@/services/retentionsService";
import { buildJournalEntry } from "@/utils/buildJournalEntry";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const parseDecimal = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const sanitizeDecimalInput = (v: string) =>
  v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

const formatMoney = (v?: number) => Number(v ?? 0).toFixed(2);

/* -------------------------------------------------------------------------- */

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

  /* ================= STATE ================= */

  const [paymentAmount, setPaymentAmount] = useState("");
  const [retIR, setRetIR] = useState("");
  const [retIVA, setRetIVA] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [certificate, setCertificate] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ================= VALUES ================= */

  const balance = Number(receivable.balance ?? receivable.total ?? 0);

  const payment = parseDecimal(paymentAmount);
  const ir = parseDecimal(retIR);
  const iva = parseDecimal(retIVA);

  const totalApplied = payment + ir + iva;
  const difference = balance - totalApplied;

  const isOver = difference < -0.01;

  /* ================= ACCOUNTS ================= */

  const findAccount = (code: string) =>
    accounts.find((a) => a.code === code);

  const bankAccounts = useMemo(
    () => accounts.filter((a) => a.isBank || a.parentCode === "1010103"),
    [accounts]
  );

  const bank = bankAccounts.find((a) => a.code === bankAccountId);

  const arAccount = findAccount(receivable.account_code);
  const retIRAccount = findAccount("113020101");
  const retIVAAccount = findAccount("113020201");

  /* ================= MAIN ================= */

  const handleConfirm = async () => {
    setError("");

    if (totalApplied <= 0) return setError("Valor inválido");
    if (isOver) return setError("Excede saldo");
    if (!bank) return setError("Seleccione banco");
    if (!arAccount) return setError("Cuenta AR inválida");

    if ((ir > 0 || iva > 0) && !certificate.trim()) {
      return setError("Falta certificado");
    }

    try {
      setLoading(true);

      const tx = uuidv4();
      const entries: JournalEntry[] = [];

      /* ================= DEBIT BANK ================= */

      if (payment > 0) {
        entries.push(
          buildJournalEntry({
            entityId,
            uid: userId,
            transactionId: tx,
            date,

            account_code: bank.code,
            account_name: bank.name,

            debit: payment,
            credit: 0,

            description: `Cobro factura ${receivable.invoiceNumber}`,

            transactionType: "payment",
            documentNature: "sale",
          })
        );
      }

      /* ================= IR ================= */

      if (ir > 0 && retIRAccount) {
        entries.push(
          buildJournalEntry({
            entityId,
            uid: userId,
            transactionId: tx,
            date,

            account_code: retIRAccount.code,
            account_name: retIRAccount.name,

            debit: ir,
            credit: 0,

            description: `Ret IR ${certificate}`,

            transactionType: "payment",
            documentNature: "sale",
          })
        );
      }

      /* ================= IVA ================= */

      if (iva > 0 && retIVAAccount) {
        entries.push(
          buildJournalEntry({
            entityId,
            uid: userId,
            transactionId: tx,
            date,

            account_code: retIVAAccount.code,
            account_name: retIVAAccount.name,

            debit: iva,
            credit: 0,

            description: `Ret IVA ${certificate}`,

            transactionType: "payment",
            documentNature: "sale",
          })
        );
      }

      /* ================= CREDIT AR ================= */

      entries.push(
        buildJournalEntry({
          entityId,
          uid: userId,
          transactionId: tx,
          date,

          account_code: arAccount.code,
          account_name: arAccount.name,

          debit: 0,
          credit: totalApplied,

          description: `Cancelación factura ${receivable.invoiceNumber}`,

          transactionType: "payment",
          documentNature: "sale",
        })
      );

      /* ================= VALIDATION ================= */

      const d = entries.reduce((s, e) => s + Number(e.debit ?? 0), 0);
      const c = entries.reduce((s, e) => s + Number(e.credit ?? 0), 0);

      if (Math.abs(d - c) > 0.01) {
        throw new Error("No balanceado");
      }

      /* ================= SAVE ================= */

      await saveJournalEntries(entityId, userId, entries);

      await applyReceivablePayment(
        entityId,
        receivable,
        totalApplied,
        userId,
        tx
      );

      if (ir > 0 || iva > 0) {
        await saveRetention(entityId, {
          invoiceNumber: receivable.invoiceNumber,
          customerRUC: receivable.customerRUC,
          customerName: receivable.customerName,
          date,
          certificate,
          irRetention: ir,
          ivaRetention: iva,
          transactionId: tx,
          createdAt: new Date().toISOString(),
        });
      }

      onSuccess?.();
      onClose();

    } catch (e: any) {
      setError(e.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl w-[500px] space-y-4">

        <h2 className="font-semibold">Cobro</h2>

        <input
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(sanitizeDecimalInput(e.target.value))}
          placeholder="Pago"
          className="w-full border p-2"
        />

        <input
          value={retIR}
          onChange={(e) => setRetIR(sanitizeDecimalInput(e.target.value))}
          placeholder="IR"
          className="w-full border p-2"
        />

        <input
          value={retIVA}
          onChange={(e) => setRetIVA(sanitizeDecimalInput(e.target.value))}
          placeholder="IVA"
          className="w-full border p-2"
        />

        <select
          value={bankAccountId}
          onChange={(e) => setBankAccountId(e.target.value)}
          className="w-full border p-2"
        >
          <option value="">Banco</option>
          {bankAccounts.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>

        {error && <div className="text-red-500">{error}</div>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose}>Cancelar</button>
          <button onClick={handleConfirm} disabled={loading}>
            Confirmar
          </button>
        </div>

      </div>
    </div>
  );
}