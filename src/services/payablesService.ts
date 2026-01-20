// ============================================================================
// src/services/payablesService.ts
// Accounts Payable — CONTILISTO v1.0
// ============================================================================

import { db } from "@/firebase-config";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

import type { Payable, PayableStatus } from "@/types/Payable";
import {
  applyPaymentToInstallments,
  buildInstallmentSchedule,
} from "@/utils/payable";

import {
  fetchJournalEntriesByTransactionId,
  deleteJournalEntriesByTransactionId,
} from "./journalService";

import {
  deleteBankMovementsByJournalTransactionId,
} from "./bankMovementService";

/* ============================================================================
 * HELPERS
 * ========================================================================== */

const n2 = (x: any) =>
  Number.isFinite(Number(x)) ? Number(Number(x).toFixed(2)) : 0;

const normAcc = (c?: string) => (c || "").replace(/\./g, "").trim();

function assertPayableAccount(account_code?: string) {
  const c = normAcc(account_code);
  if (!c) throw new Error("Payable requiere cuenta contable");

  if (!c.startsWith("20101") && !c.startsWith("211") && !c.startsWith("20103")) {
    throw new Error(`Cuenta inválida para CxP: ${account_code}`);
  }
}

function assertTransactionId(tx: unknown): asserts tx is string {
  if (typeof tx !== "string" || !tx.trim()) {
    throw new Error("Payable inválido: falta transactionId");
  }
}

function assertInvoiceInvariant(
  payable: Pick<Payable, "invoiceNumber" | "issueDate">
) {
  if (!payable.invoiceNumber?.trim()) {
    throw new Error("Payable requiere número de factura");
  }
  if (!payable.issueDate?.trim()) {
    throw new Error("Payable requiere fecha de emisión");
  }
}

function computeStatus(paid: number, total: number) {
  const balance = n2(total - paid);
  if (balance <= 0) return { balance, status: "paid" as PayableStatus };
  if (paid > 0) return { balance, status: "partial" as PayableStatus };
  return { balance, status: "pending" as PayableStatus };
}

/* ============================================================================
 * FETCH
 * ========================================================================== */

export async function fetchPayableByTransactionId(
  entityId: string,
  transactionId: string
): Promise<Payable | null> {
  if (!entityId || !transactionId) return null;

  const ref = doc(db, "entities", entityId, "payables", transactionId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return { id: snap.id, ...(snap.data() as Payable) };
}

/* ============================================================================
 * UPSERT PAYABLE
 * ========================================================================== */

export async function upsertPayable(
  entityId: string,
  payable: Omit<
    Payable,
    "id" | "entityId" | "status" | "balance" | "createdAt" | "updatedAt"
  >
) {
  assertTransactionId(payable.transactionId);
  assertPayableAccount(payable.account_code);
  assertInvoiceInvariant(payable);

  const tx = payable.transactionId;
  const ref = doc(db, "entities", entityId, "payables", tx);
  const snap = await getDoc(ref);

  const paid = n2((payable as any).paid ?? 0);
  const total = n2((payable as any).total ?? 0);

  if (total <= 0) throw new Error("Payable requiere total > 0");
  if (paid < 0 || paid > total) throw new Error("Monto pagado inválido");

  const { balance, status } = computeStatus(paid, total);

  const payload: any = {
    ...(snap.exists() ? snap.data() : {}),
    ...payable,
    entityId,
    paid,
    total,
    balance,
    status,
    installmentSchedule:
      (payable as any).installmentSchedule ??
      buildInstallmentSchedule(
        total,
        payable.issueDate,
        payable.termsDays,
        payable.installments
      ),
    updatedAt: serverTimestamp(),
    ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
  };

  await setDoc(ref, payload, { merge: true });
}

/* ============================================================================
 * APPLY PAYMENT
 * ========================================================================== */

export async function applyPayablePayment(
  entityId: string,
  payable: Payable,
  amount: number
) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Monto de pago inválido");
  }

  if (!payable?.id) throw new Error("Payable inválido (id faltante)");

  const ref = doc(db, "entities", entityId, "payables", payable.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Payable no existe");

  const current = snap.data() as Payable;

  assertTransactionId(current.transactionId);
  assertPayableAccount(current.account_code);

  const paidNow = n2(current.paid);
  const total = n2(current.total);
  const { balance } = computeStatus(paidNow, total);

  if (amount > balance) throw new Error("El monto excede el saldo pendiente");

  let paidDelta = amount;
  let schedule = current.installmentSchedule ?? [];

  if (schedule.length) {
    const res = applyPaymentToInstallments(schedule, amount);
    schedule = res.updatedSchedule;
    paidDelta = res.paidDelta;
  }

  const paid = n2(paidNow + paidDelta);
  const next = computeStatus(paid, total);

  await updateDoc(ref, {
    installmentSchedule: schedule,
    paid,
    balance: next.balance,
    status: next.status,
    updatedAt: serverTimestamp(),
  });
}

/* ============================================================================
 * REPAIR LEGACY PAYABLE (NO account_code)
 * ========================================================================== */

export async function repairPayableAccountFromJournal(
  entityId: string,
  payableId: string
) {
  const ref = doc(db, "entities", entityId, "payables", payableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Payable no existe");

  const payable = snap.data() as Payable;
  assertTransactionId(payable.transactionId);

  if (payable.account_code) return payable;

  if (n2(payable.paid) > 0) {
    throw new Error("No se puede reparar un payable con pagos registrados");
  }

  const entries = await fetchJournalEntriesByTransactionId(
    entityId,
    payable.transactionId
  );

  const candidates = entries.filter((e) => {
    const c = normAcc(e.account_code);
    return (
      (c.startsWith("20103") || c.startsWith("20101") || c.startsWith("211")) &&
      n2(e.credit) > 0
    );
  });

  if (candidates.length !== 1) {
    throw new Error("Asiento ambiguo o inválido para reparación");
  }

  const picked = candidates[0];
  assertPayableAccount(picked.account_code);

  await updateDoc(ref, {
    account_code: picked.account_code,
    account_name: picked.account_name,
    updatedAt: serverTimestamp(),
  });

  return picked;
}

/* ============================================================================
 * UPDATE PAYABLE TERMS
 * ========================================================================== */

export async function updatePayableTerms(
  entityId: string,
  payableId: string,
  termsDays: number,
  installments: number
) {
  if (!entityId) throw new Error("entityId requerido");
  if (!payableId) throw new Error("payableId requerido");

  if (!Number.isInteger(termsDays) || termsDays < 0) {
    throw new Error("Plazo de días inválido");
  }
  if (!Number.isInteger(installments) || installments < 1) {
    throw new Error("Número de cuotas inválido");
  }

  const ref = doc(db, "entities", entityId, "payables", payableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Payable no existe");

  const current = snap.data() as Payable;

  if (n2(current.paid) > 0) {
    throw new Error("No se pueden modificar los plazos de un payable con pagos registrados");
  }

  assertTransactionId(current.transactionId);
  assertPayableAccount(current.account_code);
  assertInvoiceInvariant(current);

  const total = n2(current.total);
  if (total <= 0) throw new Error("Total inválido");

  const installmentSchedule = buildInstallmentSchedule(
    total,
    current.issueDate,
    termsDays,
    installments
  );

  await updateDoc(ref, {
    termsDays,
    installments,
    installmentSchedule,
    balance: total,
    status: "pending",
    updatedAt: serverTimestamp(),
  });
}

/* ============================================================================
 * DELETE PAYABLE (CASCADE)
 * ========================================================================== */

async function deletePayable(entityId: string, payableId: string) {
  await deleteDoc(doc(db, "entities", entityId, "payables", payableId));
}

async function fetchPaymentsForPayable(
  entityId: string,
  payableId: string
): Promise<{ transactionId: string }[]> {
  const ref = doc(db, "entities", entityId, "payables", payableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];

  const payable = snap.data() as any;
  const txs: string[] = Array.isArray(payable.paymentTransactionIds)
    ? payable.paymentTransactionIds.filter((x: any) => typeof x === "string" && x.trim())
    : [];

  return txs.map((transactionId) => ({ transactionId }));
}

export async function deletePayableCascade(
  entityId: string,
  transactionId: string
) {
  const payable = await fetchPayableByTransactionId(entityId, transactionId);
  if (!payable) return;

  // ✅ Fix TS: payable.id could be undefined
  if (!payable.id) {
    throw new Error("Payable inválido: falta id");
  }

  const payments = await fetchPaymentsForPayable(entityId, payable.id);

  for (const p of payments) {
    // ✅ Fix TS: p.transactionId could be undefined
    if (!p.transactionId) continue;

    await deleteJournalEntriesByTransactionId(entityId, p.transactionId);
    await deleteBankMovementsByJournalTransactionId(entityId, p.transactionId);
  }

  await deletePayable(entityId, payable.id);
}