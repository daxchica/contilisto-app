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
  query,
  where,
  limit,
} from "firebase/firestore";
import { requireEntityId } from "./requireEntityId";
import { personalExpenseExistsForInvoice } from "./personalExpenseStorageService";

/** Same normalization used in journalService so lookups match */
function normalizeInvoiceNumber(n: string): string {
  return n.replace(/\s+/g, "").toUpperCase();
}

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
  requireEntityId(entityId, "verificar invoice log");
  try {
    const uid = getAuth().currentUser?.uid;
    if (!invoiceNumber || !uid) return false;

    // 1️⃣ Fast check: is there a log entry?
    const logRef = doc(db, "entities", entityId, "invoiceLogs", invoiceNumber);
    const logSnap = await getDoc(logRef);

    if (!logSnap.exists()) return false; // Never been logged → definitely not processed

    // 2️⃣ Log exists — verify at least one journal entry still lives in Firestore.
    //    If the invoice was deleted the entries are gone even though the log survived.
    const normalized = normalizeInvoiceNumber(invoiceNumber);
    const journalCol = collection(db, "entities", entityId, "journalEntries");
    const q = query(
      journalCol,
      where("invoice_number_normalized", "==", normalized),
      limit(1)
    );
    const journalSnap = await getDocs(q);

    if (journalSnap.empty) {
      // No regular journal entry — check personalExpenses collection too.
      // (personal-expense invoices are stored there, not in journalEntries)
      const inPersonal = await personalExpenseExistsForInvoice(entityId, normalized);
      if (inPersonal) return true;

      // Stale log — clean it up silently so the invoice can be re-processed
      console.warn("🧹 Stale invoiceLog found for", invoiceNumber, "— removing.");
      try {
        await writeBatch(db).delete(logRef).commit();
      } catch {
        // best-effort; if delete fails the main flow still unblocks
      }
      return false;
    }

    return true;
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
  requireEntityId(entityId, "registrar invoice log");
  try {
    const uid = getAuth().currentUser?.uid;
    if (!invoiceNumber || !uid) return;

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
  requireEntityId(entityId, "limpiar invoice logs");

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
  requireEntityId(entityId, "eliminar invoice logs");
  if (invoiceNumbers.length === 0) return;

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
  // Delegate to checkProcessedInvoice so both functions share the same
  // dual-check logic (log + live journal entry verification).
  return checkProcessedInvoice(entityId, invoiceNumber);
}
