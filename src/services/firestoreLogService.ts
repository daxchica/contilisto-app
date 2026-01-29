import { getAuth } from "firebase/auth";
import { db } from "../firebase-config";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  DocumentReference
} from "firebase/firestore";

/* ============================================================
 * INTERNAL HELPERS
 * ============================================================ */
async function commitInBatches(refs: any[]) {
  if (!refs.length) return;

  for (let i = 0; i < refs.length; i += 500) {
    const batch = writeBatch(db);
    for (const r of refs.slice(i, i + 500)) {
      batch.delete(r);
    }
    await batch.commit();
  }
}

/* ============================================================
 * ✅ CHECK IF INVOICE WAS ALREADY PROCESSED
 * (USED BEFORE SHOWING PREVIEW MODAL)
 * ============================================================ */
export async function checkProcessedInvoice(
  entityId: string,
  invoiceNumber: string
): Promise<boolean> {
  try{
    const uid = getAuth().currentUser?.uid;
    if (!entityId || !invoiceNumber || !uid) return false;

    const ref = doc(db, "entities", entityId, "invoiceLogs", invoiceNumber);
    const snap = await getDoc(ref);

    return snap.exists();
  } catch (err) {
    console.warn(
      "⚠️ checkProcessedInvoice failed, assuming NOT processed:",
      err
    );
    // IMPORTANT: never block UI on a log check
    return false;
  }
}
/* ============================================================
 * 🧾 LOG PROCESSED INVOICE (AFTER SAVE)
 * ============================================================ */
export async function logProcessedInvoice(
  entityId: string,
  invoiceNumber: string
): Promise<void> {
  try {
    const uid = getAuth().currentUser?.uid;
    if (!entityId || !invoiceNumber || !uid) return;

    const ref = doc(db, "entities", entityId, "invoiceLogs", invoiceNumber);

    await setDoc(
      ref,
      {
        entityId,
        uid,
        invoice_number: invoiceNumber,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    console.log("🧾 Invoice logged as processed:", invoiceNumber);
  } catch (err) {
    // Logging failure should NEVER break accounting flow
    console.error("❌ Failed to log processed invoice:", err);
  }
}

/* ============================================================
 * DELETE ALL LOGS FOR ENTITY
 * ============================================================ */
export async function clearFirestoreLogForEntity(entityId: string) {
  if (!entityId) return;

  try {
    const logRef = collection(db, "entities", entityId, "invoiceLogs");
    const snapshot = await getDocs(logRef);

    const refs = snapshot.docs.map((d) => d.ref);
    await commitInBatches(refs);
  } catch (err) {
    console.error("❌ Failed to clear invoice logs for entity:", err);
  }
}


/* ============================================================
 * DELETE SELECTED INVOICE LOGS
 * ============================================================ */
export async function deleteInvoicesFromFirestoreLog(
  entityId: string,
  invoiceNumbers: string[]
) {
  if (!entityId || invoiceNumbers.length === 0) return;

  try {
    const refs = invoiceNumbers.map((n) =>
      doc(db, "entities", entityId, "invoiceLogs", n)
    );

    await commitInBatches(refs);
  } catch (err) {
    console.error("❌ Failed to delete selected invoice logs:", err);
  }
}

/* ============================================================
 * INVOICE LOGS EXISTS
 * ============================================================ */
export async function invoiceLogExists(
  entityId: string,
  invoiceNumber: string
): Promise<boolean> {
  try {
    if (!entityId || !invoiceNumber) return false;

    const ref = doc(db, "entities", entityId, "invoiceLogs", invoiceNumber);
    const snap = await getDoc(ref);

    return snap.exists();
  } catch (err) {
    console.warn(
      "⚠️ invoiceLogExists failed, assuming NOT exists:",
      err
    );
    return false;
  }
}