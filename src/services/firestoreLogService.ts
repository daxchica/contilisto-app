// src/services/firestoreLogService.ts

import { getAuth } from "firebase/auth";
import { db } from "../firebase-config";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

/* ============================================================
 * INTERNAL HELPERS
 * ============================================================ */
async function commitInBatches(refs: any[]) {
  for (let i = 0; i < refs.length; i += 500) {
    const batch = writeBatch(db);
    for (const r of refs.slice(i, i + 500)) {
      batch.delete(r);
    }
    await batch.commit();
  }
}

/* ============================================================
 * MAIN FUNCTION we need in EntitiesDashboard
 * ============================================================ */
export async function fetchProcessedInvoice(
  entityId: string,
  invoiceNumber: string
): Promise<void> {
  const uid = getAuth().currentUser?.uid;
  if (!entityId || !invoiceNumber || !uid) return;

  const invoiceRef = doc(db, "entities", entityId, "invoiceLogs", invoiceNumber);

  await setDoc(
    invoiceRef,
    {
      entityId,
      userId: uid,
      invoice_number: invoiceNumber,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  console.log("🧾 Invoice log saved:", invoiceNumber);
}

/* ============================================================
 * DELETE ALL LOGS FOR ENTITY
 * ============================================================ */
export async function clearFirestoreLogForEntity(entityId: string) {
  if (!entityId) return;

  const logRef = collection(db, "entities", entityId, "invoiceLogs");
  const snapshot = await getDocs(logRef);

  const refs = snapshot.docs.map((d) => d.ref);
  await commitInBatches(refs);
}

/* ============================================================
 * DELETE SELECTED INVOICE LOGS
 * ============================================================ */
export async function deleteInvoicesFromFirestoreLog(
  entityId: string,
  invoiceNumbers: string[]
) {
  if (!entityId || invoiceNumbers.length === 0) return;

  const refs = invoiceNumbers.map((n) =>
    doc(db, "entities", entityId, "invoiceLogs", n)
  );

  await commitInBatches(refs);
}