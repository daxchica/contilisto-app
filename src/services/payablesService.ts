// src/services/payablesService.ts
//
// CONTILISTO v1.0 — Payables Service (Accounts Payable)
//
// USER-FACING (Spanish):
// - "Cuentas por pagar": obligaciones con proveedores.
// - Los pagos se aplican contra el saldo pendiente y/o el calendario.
//
// ENGINEERING NOTES (English):
// - Payable docId = transactionId (1 invoice = 1 payable).
// - Always read the latest payable snapshot before applying payment to avoid stale UI state.
// - Payment application must be idempotent-safe at the business level (no overpay).
// - Keep Firestore writes free of undefined values (Firestore does not accept undefined).

import { db } from "@/firebase-config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import type { Payable, PayableStatus } from "@/types/Payable";
import {
  applyPaymentToInstallments,
  buildInstallmentSchedule,
} from "@/utils/payable";

/* =========================================================
 * HELPERS
 * ========================================================= */

/**
 * Compute balance + status from paid/total.
 * NOTE: balance is always rounded to 2 decimals.
 */
function computeStatus(
  paid: number,
  total: number
): { balance: number; status: PayableStatus } {
  const balance = Number((Number(total || 0) - Number(paid || 0)).toFixed(2));
  if (balance <= 0) return { balance, status: "paid" };
  if (paid > 0) return { balance, status: "partial" };
  return { balance, status: "pending" };
}

/**
 * Safe UTC due date calculation (avoids timezone drift).
 */
function calculateDueDate(issueDate: string, termsDays: number): string {
  const [y, m, d] = (issueDate || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + termsDays);
  return date.toISOString().slice(0, 10);
}

/**
 * Basic numeric safety.
 */
function n2(x: any): number {
  const v = Number(x);
  return Number.isFinite(v) ? Number(v.toFixed(2)) : 0;
}

/* =========================================================
 * FETCH
 * ========================================================= */
export async function fetchPayables(entityId: string): Promise<Payable[]> {
  if (!entityId) return [];
  const colRef = collection(db, "entities", entityId, "payables");
  const snap = await getDocs(colRef);

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Payable),
  }));
}

/* =========================================================
 * UPSERT PAYABLE
 *
 * ✅ docId = transactionId (unique per invoice)
 * ✅ does not overwrite createdAt if exists
 * ========================================================= */
export async function upsertPayable(
  entityId: string,
  payable: Omit<
    Payable,
    | "id"
    | "entityId"
    | "status"
    | "balance"
    | "createdAt"
    | "updatedAt"
  >
) {
  if (!entityId) throw new Error("entityId faltante");
  if (!payable.transactionId) throw new Error("Payable requiere transactionId");

  const ref = doc(db, "entities", entityId, "payables", payable.transactionId);
  const existing = await getDoc(ref);

  const paid = n2(payable.paid ?? 0);
  const total = n2(payable.total ?? 0);

  const { balance, status } = computeStatus(paid, total);

  const termsDays = payable.termsDays ?? 30;
  const installments = payable.installments ?? 1;

  const dueDate =
    payable.dueDate ?? calculateDueDate(payable.issueDate, termsDays);

  const installmentSchedule =
    payable.installmentSchedule ??
    buildInstallmentSchedule(total, payable.issueDate, termsDays, installments);

  // NOTE (English):
  // With merge:true, createdAt could be overwritten if we always send it.
  // Only set createdAt when doc does not exist yet.
  const basePayload: any = {
    ...payable,
    entityId,
    paid,
    total,
    balance,
    status,
    termsDays,
    installments,
    dueDate,
    installmentSchedule,
    createdFrom: payable.createdFrom ?? "ai_journal",
    updatedAt: serverTimestamp(),
  };

  if (!existing.exists()) {
    basePayload.createdAt = serverTimestamp();
  }

  await setDoc(ref, basePayload, { merge: true });

  return payable.transactionId;
}

/* =========================================================
 * APPLY PAYMENT TO PAYABLE
 *
 * IMPORTANT (English):
 * - Always fetch the latest payable from Firestore to avoid stale UI data.
 * - Prevent overpay.
 * - If schedule doesn't exist, fallback to paid += amount.
 * ========================================================= */
export async function applyPayablePayment(
  entityId: string,
  payable: Payable,
  amount: number
) {
  if (!entityId) throw new Error("entityId faltante");
  if (!payable?.id) throw new Error("payableId faltante");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Monto inválido");

  const payableRef = doc(db, "entities", entityId, "payables", payable.id);
  const snap = await getDoc(payableRef);
  if (!snap.exists()) throw new Error("Cuentas por pagar no existe");

  const current = { id: snap.id, ...(snap.data() as Payable) } as Payable;

  const total = n2(current.total ?? 0);
  const paidNow = n2(current.paid ?? 0);
  const { balance: balanceNow } = computeStatus(paidNow, total);

  const payAmount = n2(amount);

  // USER-FACING (Spanish): block overpay
  if (payAmount > balanceNow) {
    throw new Error("El monto excede el saldo pendiente");
  }

  // If there is a schedule, apply payment to installments.
  // Otherwise, fallback to simple paid += amount.
  let paidDelta = 0;
  let updatedSchedule = current.installmentSchedule ?? [];

  if (Array.isArray(updatedSchedule) && updatedSchedule.length > 0) {
    const res = applyPaymentToInstallments(updatedSchedule, payAmount);
    updatedSchedule = res.updatedSchedule;
    paidDelta = n2(res.paidDelta);
    if (paidDelta <= 0) throw new Error("El pago no pudo aplicarse");
  } else {
    // Fallback: no schedule yet (or older payables)
    paidDelta = payAmount;
  }

  const paid = n2(paidNow + paidDelta);
  const { balance, status } = computeStatus(paid, total);

  await updateDoc(payableRef, {
    installmentSchedule: updatedSchedule,
    paid,
    balance,
    status,
    updatedAt: serverTimestamp(),
  });
}

/* =========================================================
 * UPDATE STATUS (manual override)
 * ========================================================= */
export async function updatePayableStatus(
  entityId: string,
  payableId: string,
  status: PayableStatus
) {
  if (!entityId) throw new Error("entityId faltante");
  if (!payableId) throw new Error("payableId faltante");

  const ref = doc(db, "entities", entityId, "payables", payableId);

  await updateDoc(ref, {
    status,
    updatedAt: serverTimestamp(),
  });
}

/* =========================================================
 * REGISTER PAYMENT (legacy/minimal)
 *
 * NOTE (English):
 * - Prefer using: BankMovement -> Journal -> applyPayablePayment
 * - This function can stay for backward compatibility.
 * ========================================================= */
export async function registerPayablePayment(
  entityId: string,
  payableId: string,
  amount: number,
  paymentDate: string,
  bankAccountId?: string
) {
  if (!entityId) throw new Error("entityId faltante");
  if (!payableId) throw new Error("payableId faltante");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Monto inválido");
  if (!paymentDate) throw new Error("paymentDate faltante");

  const ref = doc(db, "entities", entityId, "payables", payableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Payable no existe");

  const current = { id: snap.id, ...(snap.data() as Payable) } as Payable;

  const total = n2(current.total ?? 0);
  const paidNow = n2(current.paid ?? 0);
  const { balance: balanceNow } = computeStatus(paidNow, total);

  const payAmount = n2(amount);
  if (payAmount > balanceNow) {
    throw new Error("El monto excede el saldo pendiente");
  }

  let paid = paidNow;
  let installmentSchedule = current.installmentSchedule ?? [];

  if (Array.isArray(installmentSchedule) && installmentSchedule.length > 0) {
    const { updatedSchedule, paidDelta } = applyPaymentToInstallments(
      installmentSchedule,
      payAmount
    );
    if (n2(paidDelta) <= 0) throw new Error("El pago no pudo aplicarse");
    installmentSchedule = updatedSchedule;
    paid = n2(paid + paidDelta);
  } else {
    paid = n2(paid + payAmount);
  }

  const { balance, status } = computeStatus(paid, total);

  // NOTE (English):
  // We do not write fields that might not exist in the Payable type to avoid TS errors.
  // If you want lastPaymentDate/lastPaymentBankAccountId, add them to Payable type first.
  await updateDoc(ref, {
    paid,
    balance,
    status,
    installmentSchedule,
    updatedAt: serverTimestamp(),
  });

  // paymentDate and bankAccountId are accepted for UI flow,
  // but not persisted unless you add typed fields to Payable.
  void paymentDate;
  void bankAccountId;
}

/* =========================================================
 * UPDATE TERMS (PRODUCTION SAFE)
 * ========================================================= */
export async function updatePayableTerms(
  entityId: string,
  payableId: string,
  termsDays: number,
  installments: number,
  issueDate: string
) {
  if (!entityId) throw new Error("entityId faltante");
  if (!payableId) throw new Error("payableId faltante");

  if (!Number.isFinite(termsDays) || termsDays < 1 || termsDays > 3650) {
    throw new Error("termsDays inválido (1..3650)");
  }
  if (!Number.isFinite(installments) || installments < 1 || installments > 60) {
    throw new Error("installments inválido (1..60)");
  }
  if (!issueDate) throw new Error("issueDate faltante");

  // 1) Validate entity exists
  const entityRef = doc(db, "entities", entityId);
  if (!(await getDoc(entityRef)).exists()) {
    throw new Error(`Empresa no existe: entities/${entityId}`);
  }

  // 2) Validate payable exists
  const payableRef = doc(db, "entities", entityId, "payables", payableId);
  const payableSnap = await getDoc(payableRef);
  if (!payableSnap.exists()) {
    throw new Error(`Payable no existe en la empresa seleccionada: ${payableId}`);
  }

  const payable = payableSnap.data() as Payable;

  // 3) Accounting lock: cannot change terms if already paid
  if ((payable.paid ?? 0) > 0) {
    throw new Error("No se pueden modificar plazos cuando ya existen pagos registrados");
  }

  // 4) Recalculate due date + schedule
  const dueDate = calculateDueDate(issueDate, termsDays);
  const installmentSchedule = buildInstallmentSchedule(
    n2(payable.total ?? 0),
    issueDate,
    termsDays,
    installments
  );

  const { balance, status } = computeStatus(payable.paid ?? 0, payable.total);

  // 5) Update
  await updateDoc(payableRef, {
    termsDays,
    installments,
    issueDate,
    dueDate,
    installmentSchedule,
    balance,
    status,
    updatedAt: serverTimestamp(),
  });
}