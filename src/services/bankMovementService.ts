// ============================================================================
// src/services/bankMovementService.ts
// ---------------------------------------------------------------------------
// Bank Movement Service — CONTILISTO v1.0
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
} from "firebase/firestore";

/* ============================================================================
 * Types
 * ========================================================================== */

export type BankMovementType = "in" | "out" | "transfer";

export interface BankMovement {
  id?: string;

  entityId: string;
  bankAccountId: string;

  /**
   * Value date of the movement (YYYY-MM-DD)
   */
  date: string;

  /**
   * Signed amount:
   *  - Positive => cash inflow
   *  - Negative => cash outflow
   */
  amount: number;

  /**
   * Movement type
   */
  type: BankMovementType;

  /**
   * User-facing description (Spanish)
   */
  description: string;

  reference?: string;

  /**
   * Accounting traceability
   */
  relatedInvoiceId?: string;
  relatedJournalTransactionId?: string;

  /**
   * Reconciliation flags
   */
  reconciled?: boolean;
  reconciledAt?: any;

  /**
   * Metadata
   */
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

/* ============================================================================
 * Helpers
 * ========================================================================== */

/**
 * Ensures amount sign consistency based on movement type.
 */
function normalizeAmount(amount: number, type: BankMovementType): number {
  if (type === "in" && amount < 0) return Math.abs(amount);
  if (type === "out" && amount > 0) return -Math.abs(amount);
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
  return Boolean(
    movement.reconciled || movement.relatedJournalTransactionId
  );
}

/* ============================================================================
 * CRUD Operations
 * ========================================================================== */

export async function createBankMovement(
  movement: BankMovement
): Promise<string> {
  if (!movement.entityId) throw new Error("entityId es requerido");
  if (!movement.bankAccountId) throw new Error("Cuenta bancaria requerida");
  if (!movement.date) throw new Error("Fecha requerida");
  if (!movement.amount) throw new Error("Monto requerido");

  if (movement.type === "transfer" && movement.amount === 0) {
    throw new Error("La transferencia debe tener un monto válido");
  }

  const normalizedAmount = normalizeAmount(
    movement.amount,
    movement.type
  );

  const colRef = collection(
    db,
    "entities",
    movement.entityId,
    "bankMovements"
  );

  const docRef = await addDoc(colRef, {
    ...movement,
    amount: normalizedAmount,
    reconciled: false,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function updateBankMovement(
  entityId: string,
  movementId: string,
  data: Partial<BankMovement>
): Promise<void> {
  const ref = doc(
    db,
    "entities",
    entityId,
    "bankMovements",
    movementId
  );

  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Movimiento no encontrado");

  const current = snap.data() as BankMovement;

  // Enforce accounting invariants
  if (
    data.amount !== undefined ||
    data.type !== undefined ||
    data.bankAccountId !== undefined
  ) {
    assertEditable(current);
  }

  const normalized =
    data.amount !== undefined && data.type
      ? normalizeAmount(data.amount, data.type)
      : data.amount;

  await updateDoc(ref, {
    ...data,
    ...(normalized !== undefined ? { amount: normalized } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function linkJournalTransaction(
  entityId: string,
  movementId: string,
  transactionId: string
): Promise<void> {
  if (!transactionId) {
    throw new Error("transactionId es requerido para el enlace contable");
  }

  const ref = doc(
    db,
    "entities",
    entityId,
    "bankMovements",
    movementId
  );

  await updateDoc(ref, {
    relatedJournalTransactionId: transactionId,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBankMovement(
  entityId: string,
  movementId: string
): Promise<void> {
  const ref = doc(
    db,
    "entities",
    entityId,
    "bankMovements",
    movementId
  );

  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const movement = snap.data() as BankMovement;

  if (isBankMovementLocked(movement)) {
    throw new Error(
      "No se puede eliminar un movimiento conciliado o vinculado al diario"
    );
  }

  await deleteDoc(ref);
}

/* ============================================================================
 * Queries
 * ========================================================================== */

export async function fetchBankMovements(
  entityId: string,
  from?: string,
  to?: string
): Promise<BankMovement[]> {
  if (!entityId) return [];

  const colRef = collection(
    db,
    "entities",
    entityId,
    "bankMovements"
  );

  let qRef = query(colRef, orderBy("date", "asc"));

  if (from && to) {
    qRef = query(
      colRef,
      where("date", ">=", from),
      where("date", "<=", to),
      orderBy("date", "asc")
    );
  }

  const snap = await getDocs(qRef);

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as BankMovement),
  }));
}

export async function reconcileBankMovement(
  entityId: string,
  movementId: string
): Promise<void> {
  const ref = doc(
    db,
    "entities",
    entityId,
    "bankMovements",
    movementId
  );

  await updateDoc(ref, {
    reconciled: true,
    reconciledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}