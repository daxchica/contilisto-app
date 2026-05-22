// ============================================================================
// src/services/personalExpenseStorageService.ts
// CONTILISTO — Firestore CRUD for the personalExpenses sub-collection.
//
// Collection path: entities/{entityId}/personalExpenses
// ============================================================================

import { db } from "@/firebase-config";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  limit,
} from "firebase/firestore";

import { requireEntityId } from "./requireEntityId";
import type { PersonalExpenseRecord } from "@/types/PersonalExpenseRecord";

// ============================================================================
// SAVE
// ============================================================================

export async function savePersonalExpenseRecord(
  entityId: string,
  record: PersonalExpenseRecord
): Promise<void> {
  requireEntityId(entityId, "guardar gasto personal");
  const col = collection(db, "entities", entityId, "personalExpenses");
  const batch = writeBatch(db);
  batch.set(doc(col, record.id), record);
  await batch.commit();
}

// ============================================================================
// FETCH ALL FOR ENTITY
// ============================================================================

export async function fetchPersonalExpenses(
  entityId: string
): Promise<PersonalExpenseRecord[]> {
  requireEntityId(entityId, "cargar gastos personales");
  const col = collection(db, "entities", entityId, "personalExpenses");
  const snap = await getDocs(col);
  return snap.docs.map((d) => d.data() as PersonalExpenseRecord);
}

// ============================================================================
// DELETE BY TRANSACTION ID  (used by annulInvoiceByTransaction)
// ============================================================================

export async function deletePersonalExpensesByTransaction(
  entityId: string,
  transactionId: string
): Promise<void> {
  requireEntityId(entityId, "eliminar gasto personal");
  if (!transactionId) return;

  const col = collection(db, "entities", entityId, "personalExpenses");
  const q = query(col, where("transactionId", "==", transactionId));
  const snap = await getDocs(q);

  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ============================================================================
// EXISTS CHECK (used by checkProcessedInvoice to validate stale logs)
// ============================================================================

export async function personalExpenseExistsForInvoice(
  entityId: string,
  invoiceNumberNormalized: string
): Promise<boolean> {
  if (!invoiceNumberNormalized) return false;

  const col = collection(db, "entities", entityId, "personalExpenses");
  const q = query(
    col,
    where("invoice_number_normalized", "==", invoiceNumberNormalized),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}
