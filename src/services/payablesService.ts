// src/services/payablesService.ts

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
function computeStatus(
  paid: number,
  total: number
): { balance: number; status: PayableStatus } {
  const balance = Number((Number(total || 0) - Number(paid || 0)).toFixed(2));
  if (balance <= 0) return { balance, status: "paid" };
  if (paid > 0) return { balance, status: "partial" };
  return { balance, status: "pending" };
}

// ⚠️ Cálculo UTC seguro (evita bugs de timezone)
function calculateDueDate(issueDate: string, termsDays: number): string {
  const [y, m, d] = (issueDate || "").split("-").map(Number);
  if (!y || !m || !d) return ""; // evita crash si issueDate viene mal
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + termsDays);
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
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
 * ✅ docId = transactionId (único por factura)
 * ✅ no pisa createdAt si ya existe
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
  if (!payable.transactionId) {
    throw new Error("Payable requiere transactionId");
  }

  const ref = doc(db, "entities", entityId, "payables", payable.transactionId);
  const existing = await getDoc(ref);

  const paid = payable.paid ?? 0;
  const { balance, status } = computeStatus(paid, payable.total);

  const termsDays = payable.termsDays ?? 30;
  const installments = payable.installments ?? 1;

  const dueDate =
    payable.dueDate ?? calculateDueDate(payable.issueDate, termsDays);

  const installmentSchedule =
    payable.installmentSchedule ??
    buildInstallmentSchedule(
      payable.total,
      payable.issueDate,
      termsDays,
      installments
    );

  // Nota: con merge true, createdAt puede pisarse si lo enviamos siempre.
  // Por eso solo lo ponemos si NO existe el doc.
  const basePayload: any = {
    ...payable,
    entityId,
    paid,
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
 * ========================================================= */
export async function applyPayablePayment(
  entityId: string,
  payable: Payable,
  amount: number
) {
  if (!entityId) throw new Error("entityId faltante");
  if (!payable?.id) throw new Error("payableId faltante");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Monto inválido");

  if (!payable.installmentSchedule?.length) {
    throw new Error("No existe calendario de pagos");
  }

  const { updatedSchedule, paidDelta } = applyPaymentToInstallments(
    payable.installmentSchedule,
    amount
  );

  if (paidDelta <= 0) throw new Error("El pago no pudo aplicarse");

  const paid = Number((Number(payable.paid || 0) + paidDelta).toFixed(2));
  const { balance, status } = computeStatus(paid, payable.total);

  const ref = doc(db, "entities", entityId, "payables", payable.id);

  await updateDoc(ref, {
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
 * REGISTER PAYMENT (minimal implementation)
 *
 * Para que la UI refleje cambios incluso si el modal todavía
 * no registra transacciones bancarias.
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

  const payable = snap.data() as Payable;

  // Si hay calendario, aplicamos al calendario; si no, solo suma paid.
  let paid = Number(payable.paid || 0);
  let installmentSchedule = payable.installmentSchedule ?? [];

  if (installmentSchedule.length) {
    const { updatedSchedule, paidDelta } = applyPaymentToInstallments(
      installmentSchedule,
      amount
    );
    if (paidDelta <= 0) throw new Error("El pago no pudo aplicarse");
    installmentSchedule = updatedSchedule;
    paid = Number((paid + paidDelta).toFixed(2));
  } else {
    paid = Number((paid + amount).toFixed(2));
  }

  const { balance, status } = computeStatus(paid, payable.total);

  await updateDoc(ref, {
    paid,
    balance,
    status,
    installmentSchedule,
    lastPaymentDate: paymentDate, // si tu tipo no lo tiene, quítalo
    lastPaymentBankAccountId: bankAccountId ?? null, // si tu tipo no lo tiene, quítalo
    updatedAt: serverTimestamp(),
  });
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

  // 1) Validar empresa real
  const entityRef = doc(db, "entities", entityId);
  if (!(await getDoc(entityRef)).exists()) {
    throw new Error(`Empresa no existe: entities/${entityId} (posible uid mal pasado)`);
  }

  // 2) Validar payable
  const payableRef = doc(db, "entities", entityId, "payables", payableId);
  const payableSnap = await getDoc(payableRef);
  if (!payableSnap.exists()) {
    throw new Error(`Payable no existe en la empresa seleccionada: ${payableId}`);
  }

  const payable = payableSnap.data() as Payable;

  // 3) Bloqueo contable
  if ((payable.paid ?? 0) > 0) {
    throw new Error("No se pueden modificar plazos cuando el documento ya tiene pagos registrados");
  }

  // 4) Recalcular fechas y calendario
  const dueDate = calculateDueDate(issueDate, termsDays);
  const installmentSchedule = buildInstallmentSchedule(
    payable.total,
    issueDate,
    termsDays,
    installments
  );

  const { balance, status } = computeStatus(payable.paid ?? 0, payable.total);

  // 5) Actualizar
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