// ============================================================================
// src/services/bankMovementService.ts
// ---------------------------------------------------------------------------
// Bank Movement Service — CONTILISTO v1.0 (COMPLETE IMPROVED VERSION)
//
// SINGLE SOURCE OF TRUTH for all real cash movements (Bank / Cash).
//
// ACCOUNTING INVARIANTS:
// 1. Every real cash inflow/outflow MUST be registered here first.
// 2. Journal entries MUST be derived from bank movements.
// 3. Reconciled or journal-linked movements MUST NOT be altered or deleted.
//
// USER-FACING CONCEPT (Spanish):
// - "Libro Bancos": registro real de ingresos y egresos de dinero.
// ============================================================================

import { db } from "@/firebase-config";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  type QueryConstraint,
} from "firebase/firestore";
import type { BankMovement, BankMovementType } from "@/types/bankTypes";
import { requireEntityId } from "./requireEntityId";

export type { BankMovement, BankMovementType } from "@/types/bankTypes";

/* ============================================================================
 * Helpers
 * ========================================================================== */

function normalizeDate(date: string): string {
  if (!date?.trim()) throw new Error("Fecha inválida");

  if (/^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);

  const m = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const day = m[1];
    const month = m[2];
    const year = m[3];
    return `${year}-${month}-${day}`;
  }

  throw new Error(`Formato de fecha inválido: ${date}`);
}

/**
 * Ensures amount sign consistency based on movement type.
 * "in"  => positive
 * "out" => negative
 */
function normalizeAmount(amount: number, type: BankMovementType): number {
  if (!Number.isFinite(amount)) {
    throw new Error("Monto inválido");
  }

  if (type === "in") return Math.abs(amount);
  if (type === "out") return -Math.abs(amount);

  return amount;
}

/**
 * Prevents illegal updates once accounting linkage exists.
 */
function assertEditable(movement: BankMovement) {
  if (movement.reconciled) {
    throw new Error("El movimiento ya está conciliado y no puede modificarse");
  }

  if (movement.relatedJournalTransactionId) {
    throw new Error(
      "El movimiento ya está vinculado al libro diario y no puede modificarse"
    );
  }
}

/**
 * Helper for UI and services
 */
export function isBankMovementLocked(movement: BankMovement): boolean {
  return Boolean(movement.reconciled || movement.relatedJournalTransactionId);
}

/* ============================================================================
 * CRUD Operations
 * ========================================================================== */

export async function createBankMovement(
  movement: BankMovement
): Promise<string> {
  requireEntityId(movement.entityId, "crear movimiento");

  if (!movement.bankAccountId?.trim()) {
    throw new Error("Cuenta bancaria requerida");
  }

  if (!movement.date?.trim()) {
    throw new Error("Fecha requerida");
  }

  if (!movement.type) {
    throw new Error("Tipo de movimiento requerido");
  }

  const normalizedDate = normalizeDate(movement.date);
  const normalizedAmount = normalizeAmount(movement.amount, movement.type);

  if (normalizedAmount === 0) {
    throw new Error("La transferencia debe tener un monto válido");
  }

  const colRef = collection(db, "entities", movement.entityId, "bankMovements");

  const docRef = await addDoc(colRef, {
    ...movement,
    date: normalizedDate,
    amount: normalizedAmount,
    reconciled: Boolean(movement.reconciled ?? false),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function updateBankMovement(
  entityId: string,
  movementId: string,
  data: Partial<BankMovement>
): Promise<void> {
  requireEntityId(entityId, "actualizar movimiento");

  if (!movementId?.trim()) {
    throw new Error("movementId requerido para actualizar movimiento");
  }

  const ref = doc(db, "entities", entityId, "bankMovements", movementId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error("Movimiento no encontrado");

  const current = snap.data() as BankMovement;

  if (
    data.amount !== undefined ||
    data.type !== undefined ||
    data.bankAccountId !== undefined
  ) {
    assertEditable(current);
  }

  let normalizedAmount: number | undefined = undefined;

  if (data.amount !== undefined) {
    const newType = data.type ?? current.type;
    normalizedAmount = normalizeAmount(data.amount, newType);
  }

  const payload: Record<string, unknown> = {
    ...data,
    updatedAt: serverTimestamp(),
  };

  if (data.date !== undefined) {
    payload.date = normalizeDate(data.date);
  }

  if (normalizedAmount !== undefined) {
    payload.amount = normalizedAmount;
  }

  await updateDoc(ref, payload);
}

export async function linkJournalTransaction(
  entityId: string,
  movementId: string,
  transactionId: string
): Promise<void> {
  requireEntityId(entityId, "vincular movimiento");

  if (!movementId?.trim()) {
    throw new Error("movementId requerido");
  }

  if (!transactionId?.trim()) {
    throw new Error("transactionId requerido");
  }

  const ref = doc(db, "entities", entityId, "bankMovements", movementId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error("Movimiento no encontrado");

  const movement = snap.data() as BankMovement;

  if (movement.reconciled) {
    throw new Error("Movimiento conciliado no puede vincularse a un asiento");
  }

  await updateDoc(ref, {
    relatedJournalTransactionId: transactionId,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBankMovement(
  entityId: string,
  movementId: string
): Promise<void> {
  requireEntityId(entityId, "eliminar movimiento");

  if (!movementId?.trim()) {
    throw new Error("movementId requerido para eliminar movimiento");
  }

  const ref = doc(db, "entities", entityId, "bankMovements", movementId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error("Movimiento no encontrado");

  const movement = snap.data() as BankMovement;

  if (isBankMovementLocked(movement)) {
    throw new Error("Movimiento bloqueado no puede eliminarse");
  }

  await deleteDoc(ref);
}

export async function deleteBankMovementsByJournalTransactionId(
  entityId: string,
  journalTransactionId: string
): Promise<void> {
  requireEntityId(entityId, "eliminar movimientos");

  if (!journalTransactionId?.trim()) {
    throw new Error("journalTransactionId requerido");
  }

  const colRef = collection(db, "entities", entityId, "bankMovements");
  const qRef = query(
    colRef,
    where("relatedJournalTransactionId", "==", journalTransactionId)
  );

  const snap = await getDocs(qRef);

  if (snap.empty) return;

  const batch = writeBatch(db);

  snap.forEach((d) => {
    const data = d.data() as BankMovement;

    if (data.reconciled) {
      throw new Error("No se pueden eliminar movimientos conciliados");
    }

    batch.delete(d.ref);
  });

  await batch.commit();
}

/* ============================================================================
 * Queries
 * ========================================================================== */

export async function fetchBankMovements(
  entityId: string,
  bankAccountId?: string,
  from?: string,
  to?: string
): Promise<BankMovement[]> {
  requireEntityId(entityId, "cargar movimientos");

  const colRef = collection(db, "entities", entityId, "bankMovements");
  const constraints: QueryConstraint[] = [];

  if (bankAccountId?.trim()) {
    constraints.push(where("bankAccountId", "==", bankAccountId));
  }

  if (from?.trim()) {
    constraints.push(where("date", ">=", normalizeDate(from)));
  }

  if (to?.trim()) {
    constraints.push(where("date", "<=", normalizeDate(to)));
  }

  constraints.push(orderBy("date", "asc"));

  const qRef = query(colRef, ...constraints);
  const snap = await getDocs(qRef);

  return snap.docs.map((d) => {
    const data = d.data() as BankMovement;
    return {
      ...data,
      id: d.id,
    };
  });
}

export async function reconcileBankMovement(
  entityId: string,
  movementId: string
): Promise<void> {
  requireEntityId(entityId, "conciliar movimiento");

  if (!movementId?.trim()) {
    throw new Error("movementId requerido para conciliar movimiento");
  }

  const ref = doc(db, "entities", entityId, "bankMovements", movementId);

  await updateDoc(ref, {
    reconciled: true,
    reconciledAt: serverTimestamp(),
    reconciledBy: "system",
    updatedAt: serverTimestamp(),
  });
}

export async function unreconcileBankMovement(
  entityId: string,
  movementId: string
): Promise<void> {
  requireEntityId(entityId, "desconciliar movimiento");

  if (!movementId?.trim()) {
    throw new Error("movementId requerido para desconciliar movimiento");
  }

  const ref = doc(db, "entities", entityId, "bankMovements", movementId);

  await updateDoc(ref, {
    reconciled: false,
    reconciledAt: null,
    reconciledBy: null,
    updatedAt: serverTimestamp(),
  });
}

/* ============================================================================
 * Transfers
 * ========================================================================== */

type CreateTransferArgs = {
  entityId: string;
  date: string;
  amount: number; // positive input
  fromBankAccountId: string;
  toBankAccountId: string;
  fromAccountCode: string;
  toAccountCode: string;
  description?: string;
  reference?: string;
  createdBy?: string;
};

export async function createInterBankTransfer(
  args: CreateTransferArgs
): Promise<{
  transferId: string;
  outMovementId: string;
  inMovementId: string;
}> {
  const {
    entityId,
    date,
    amount,
    fromBankAccountId,
    toBankAccountId,
    fromAccountCode,
    toAccountCode,
    description,
    reference,
    createdBy,
  } = args;

  requireEntityId(entityId, "transferencia bancaria");

  if (!date?.trim()) throw new Error("Fecha requerida");
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Monto inválido");
  }

  if (!fromBankAccountId?.trim()) {
    throw new Error("Cuenta origen requerida");
  }

  if (!toBankAccountId?.trim()) {
    throw new Error("Cuenta destino requerida");
  }

  if (fromBankAccountId === toBankAccountId) {
    throw new Error("La cuenta origen y destino no pueden ser iguales");
  }

  const transferId =
    (globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random()}`).toString();

  const outMovementId = await createBankMovement({
    entityId,
    bankAccountId: fromBankAccountId,
    date,
    amount: -Math.abs(amount),
    type: "out",
    description: description ?? "Transferencia entre bancos (salida)",
    reference,
    createdBy,
    reconciled: false,
    transfer: { transferId, fromAccountCode, toAccountCode },
  } as BankMovement);

  const inMovementId = await createBankMovement({
    entityId,
    bankAccountId: toBankAccountId,
    date,
    amount: Math.abs(amount),
    type: "in",
    description: description ?? "Transferencia entre bancos (entrada)",
    reference,
    createdBy,
    reconciled: false,
    transfer: { transferId, fromAccountCode, toAccountCode },
  } as BankMovement);

  return { transferId, outMovementId, inMovementId };
}

export async function linkJournalTransactionByTransferId(
  entityId: string,
  transferId: string,
  transactionId: string
): Promise<void> {
  requireEntityId(entityId, "vincular transferencia");

  if (!transferId?.trim()) throw new Error("transferId requerido");
  if (!transactionId?.trim()) throw new Error("transactionId requerido");

  const colRef = collection(db, "entities", entityId, "bankMovements");
  const qRef = query(colRef, where("transfer.transferId", "==", transferId));
  const snap = await getDocs(qRef);

  if (snap.empty) return;

  const batch = writeBatch(db);

  snap.docs.forEach((d) => {
    batch.update(d.ref, {
      relatedJournalTransactionId: transactionId,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}