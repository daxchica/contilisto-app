// ============================================================================
// src/services/payablesService.ts
// Accounts Payable — CONTILISTO v2.0 (FULLY SAFE + PAYMENT TRACKING)
// ============================================================================

import { db } from "@/firebase-config";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";

import type { Payable, PayableStatus } from "@/types/Payable";
import {
  applyPaymentToInstallments,
  buildInstallmentSchedule,
} from "@/utils/payable";

import {
  fetchJournalEntriesByTransactionId,
  annulInvoiceByTransaction,
} from "./journalService";

import {
  deleteBankMovementsByJournalTransactionId,
} from "./bankMovementService";

import { requireEntityId } from "./requireEntityId";
import { requireNonEmpty } from "./requireNonEmpty";
import { isSupplierPayableAccount } from "./controlAccounts";

/* ============================================================================
 * HELPERS
 * ========================================================================== */

const n2 = (x: any) =>
  Number.isFinite(Number(x)) ? Number(Number(x).toFixed(2)) : 0;

const normAcc = (c?: string) => (c || "").replace(/\./g, "").trim();

const normalizeInvoiceNumber = (n?: string) =>
  String(n ?? "").replace(/\s+/g, "").replace(/-/g, "").trim();

function assertPayableAccount(account_code?: string) {
  const c = normAcc(account_code);

  if (!c) throw new Error("Payable requiere cuenta contable");

  if (!isSupplierPayableAccount(c)) {
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
  requireEntityId(entityId, "cargar CxP");

  if (!transactionId) return null;

  const ref = doc(db, "entities", entityId, "payables", transactionId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return { id: snap.id, ...(snap.data() as Payable) };
}

/* ============================================================================
 * FETCH PAYABLES
 * ========================================================================== */

export async function fetchPayables(entityId: string): Promise<Payable[]> {
  requireEntityId(entityId, "cargar CxP");

  const colRef = collection(db, "entities", entityId, "payables");
  const qRef = query(colRef, orderBy("issueDate", "desc"));

  const snap = await getDocs(qRef);

  return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({
    id: d.id,
    ...(d.data() as Payable),
  }));
}

/* ============================================================================
 * UPSERT PAYABLE (SAFE — NO OVERWRITE OF PAYMENTS)
 * ========================================================================== */

export async function upsertPayable(
  entityId: string,
  payable: Omit<
    Payable,
    "id" | "entityId" | "status" | "balance" | "createdAt" | "updatedAt"
  >
) {
  requireEntityId(entityId, "guardar CxP");

  assertTransactionId(payable.transactionId);
  assertPayableAccount(payable.account_code);
  assertInvoiceInvariant(payable);

  requireNonEmpty(payable.account_code, "account code");

  const tx = payable.transactionId;
  const ref = doc(db, "entities", entityId, "payables", tx);
  const snap = await getDoc(ref);

  const existing = snap.exists() ? (snap.data() as Payable) : null;

  const total = n2((payable as any).total ?? existing?.total ?? 0);
  const paid = existing ? n2(existing.paid) : n2((payable as any).paid ?? 0);

  if (total <= 0) throw new Error("Payable requiere total > 0");

  const { balance, status } = computeStatus(paid, total);

  const payload: any = {
    entityId,
    transactionId: payable.transactionId,

    invoiceNumber: payable.invoiceNumber.trim(),
    invoiceNumberNormalized:
      payable.invoiceNumberNormalized ??
      normalizeInvoiceNumber(payable.invoiceNumber),

    issueDate: payable.issueDate.trim(),

    supplierName: String(payable.supplierName ?? "").trim(),
    supplierRUC: String(payable.supplierRUC ?? "").replace(/\D/g, ""),

    account_code: normAcc(payable.account_code),
    account_name: payable.account_name?.trim() || "Proveedores",

    total,
    paid,
    balance,
    status,

    termsDays: payable.termsDays,
    installments: payable.installments,

    installmentSchedule:
      existing?.installmentSchedule?.length
        ? existing.installmentSchedule
        : buildInstallmentSchedule(
            total,
            payable.issueDate,
            payable.termsDays ?? 30,
            payable.installments ?? 1
          ),

    paymentTransactionIds: existing?.paymentTransactionIds ?? [],
    payments: (existing as any)?.payments ?? [],

    createdFrom: payable.createdFrom,

    updatedAt: serverTimestamp(),
    ...(existing ? {} : { createdAt: serverTimestamp() }),
  };

  await setDoc(ref, payload, { merge: true });
}

/* ============================================================================
 * APPLY PAYMENT (FULL TRACKING + RETENTIONS)
 * ========================================================================== */

export async function applyPayablePayment(
  entityId: string,
  payable: Payable,
  amountApplied: number,
  userIdSafe?: string,
  paymentTransactionId?: string,
  options?: {
    cashPaid?: number;
    retentionIR?: number;
    retentionIVA?: number;
    paymentDate?: string;
    certificate?: string;
  }
) {
  requireEntityId(entityId, "registrar pago");

  if (!Number.isFinite(amountApplied) || amountApplied <= 0) {
    throw new Error("Monto de pago inválido");
  }

  if (!payable?.id) {
    throw new Error("Payable inválido (id faltante)");
  }

  const ref = doc(db, "entities", entityId, "payables", payable.id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Payable no existe");
  }

  const current = snap.data() as Payable;

  assertTransactionId(current.transactionId);
  assertPayableAccount(current.account_code);
  assertInvoiceInvariant(current);

  const total = n2(current.total);
  const paidNow = n2(current.paid);
  const balance = n2(current.balance ?? total - paidNow);

  if (amountApplied > balance) {
    throw new Error("El monto excede el saldo pendiente");
  }

  let paidDelta = amountApplied;
  let schedule = current.installmentSchedule ?? [];

  if (schedule.length) {
    const res = applyPaymentToInstallments(schedule, amountApplied);
    schedule = res.updatedSchedule;
    paidDelta = n2(res.paidDelta);
  }

  const paid = n2(paidNow + paidDelta);
  const next = computeStatus(paid, total);

  const paymentRecord = {
    transactionId: paymentTransactionId ?? "",
    amountApplied: n2(amountApplied),
    cashPaid: n2(options?.cashPaid ?? amountApplied),
    retentionIR: n2(options?.retentionIR ?? 0),
    retentionIVA: n2(options?.retentionIVA ?? 0),
    paymentDate:
      options?.paymentDate ?? new Date().toISOString().slice(0, 10),
    certificate: String(options?.certificate ?? "").trim(),
    createdBy: String(userIdSafe ?? "").trim(),
    createdAt: Date.now(),
  };

  const existingIds = Array.isArray((current as any).paymentTransactionIds)
    ? (current as any).paymentTransactionIds
    : [];

  const existingPayments = Array.isArray((current as any).payments)
    ? (current as any).payments
    : [];

  const nextIds =
    paymentTransactionId && !existingIds.includes(paymentTransactionId)
      ? [...existingIds, paymentTransactionId]
      : existingIds;

  const nextPayments =
    paymentTransactionId &&
    existingPayments.some((p: any) => p.transactionId === paymentTransactionId)
      ? existingPayments
      : [...existingPayments, paymentRecord];

  await updateDoc(ref, {
    installmentSchedule: schedule,
    paid,
    balance: next.balance,
    status: next.status,
    paymentTransactionIds: nextIds,
    payments: nextPayments,
    updatedAt: serverTimestamp(),
  });
}

/* ============================================================================
 * REMAINING FUNCTIONS (UNCHANGED — SAFE)
 * ========================================================================== */

export async function repairPayableAccountFromJournal(
  entityId: string,
  payableId: string
) {
  requireEntityId(entityId, "reparar CxP");
  if (!payableId?.trim()) throw new Error("payableId requerido");

  const ref = doc(db, "entities", entityId, "payables", payableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Payable no existe");

  const payable = snap.data() as Payable;

  if (payable.account_code) return payable;

  if (n2(payable.paid) > 0) {
    throw new Error("No se puede reparar un payable con pagos registrados");
  }

  const entries = await fetchJournalEntriesByTransactionId(
    entityId,
    payable.transactionId
  );

  const candidates = entries.filter(
    (e) => normAcc(e.account_code).startsWith("20103") && n2(e.credit) > 0
  );

  if (candidates.length !== 1) {
    throw new Error("Asiento ambiguo o inválido");
  }

  const picked = candidates[0];

  await updateDoc(ref, {
    account_code: picked.account_code,
    account_name: picked.account_name,
    updatedAt: serverTimestamp(),
  });

  return picked;
}

export async function deletePayableCascade(
  entityId: string,
  transactionId: string
) {
  requireEntityId(entityId, "eliminar CxP");

  const payable = await fetchPayableByTransactionId(entityId, transactionId);
  if (!payable || !payable.id) return;

  const payments = Array.isArray((payable as any).paymentTransactionIds)
    ? (payable as any).paymentTransactionIds
    : [];

  for (const tx of payments) {
    if (!tx) continue;
    await annulInvoiceByTransaction(entityId, tx);
    await deleteBankMovementsByJournalTransactionId(entityId, tx);
  }

  await deleteDoc(doc(db, "entities", entityId, "payables", payable.id));
}

/* ============================================================================
 * UPDATE PAYABLE TERMS (SAFE)
 * ========================================================================== */

export async function updatePayableTerms(
  entityId: string,
  payableId: string,
  termsDays: number,
  installments: number
) {
  requireEntityId(entityId, "actualizar términos CxP");

  if (!payableId?.trim()) {
    throw new Error("payableId requerido");
  }

  if (!Number.isFinite(termsDays) || termsDays <= 0) {
    throw new Error("termsDays inválido");
  }

  if (!Number.isFinite(installments) || installments <= 0) {
    throw new Error("installments inválido");
  }

  const ref = doc(db, "entities", entityId, "payables", payableId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Payable no existe");
  }

  const current = snap.data() as Payable;

  // 🚫 DO NOT allow changing terms if already paid
  if (n2(current.paid) > 0) {
    throw new Error("No se pueden modificar términos con pagos registrados");
  }

  const total = n2(current.total);

  // 🔁 rebuild schedule safely
  const newSchedule = buildInstallmentSchedule(
    total,
    current.issueDate,
    termsDays,
    installments
  );

  // 🧮 update due date = last installment
  const dueDate =
    newSchedule.length > 0
      ? newSchedule[newSchedule.length - 1].dueDate
      : current.issueDate;

  await updateDoc(ref, {
    termsDays,
    installments,
    installmentSchedule: newSchedule,
    dueDate,
    updatedAt: serverTimestamp(),
  });

  return {
    termsDays,
    installments,
    dueDate,
    installmentSchedule: newSchedule,
  };
}