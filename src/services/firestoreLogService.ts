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

    const normalized = normalizeInvoiceNumber(invoiceNumber);
    const logRef     = doc(db, "entities", entityId, "invoiceLogs", invoiceNumber);

    // ── Helper: check live journal entries ───────────────────────────────────
    // Queries both invoice_number_normalized (new entries) AND invoice_number
    // (old entries saved before the normalized field was introduced) in parallel
    // so invoices processed with either schema are detected correctly.
    async function hasLiveJournalEntry(): Promise<boolean> {
      const journalCol = collection(db, "entities", entityId, "journalEntries");
      const [byNormalized, byRaw] = await Promise.all([
        getDocs(query(journalCol, where("invoice_number_normalized", "==", normalized), limit(1))),
        getDocs(query(journalCol, where("invoice_number", "==", invoiceNumber), limit(1))),
      ]);
      return !byNormalized.empty || !byRaw.empty;
    }

    // ── Helper: check personalExpenses ───────────────────────────────────────
    async function hasPersonalExpenseEntry(): Promise<boolean> {
      return personalExpenseExistsForInvoice(entityId, normalized);
    }

    // 1️⃣ Fast path: log exists → verify a live entry still backs it up
    const logSnap = await getDoc(logRef);

    if (logSnap.exists()) {
      const liveJournal  = await hasLiveJournalEntry();
      if (liveJournal) return true;

      const livePersonal = await hasPersonalExpenseEntry();
      if (livePersonal) return true;

      // Stale log (entry was deleted) — remove it so the invoice can be re-processed
      console.warn("🧹 Stale invoiceLog found for", invoiceNumber, "— removing.");
      try { await writeBatch(db).delete(logRef).commit(); } catch { /* best-effort */ }
      return false;
    }

    // 2️⃣ No log — the invoice may have been processed before the logging system
    //    was in place (or the log was manually removed). Check live data directly.
    const liveJournal = await hasLiveJournalEntry();
    if (liveJournal) {
      // Self-heal: write the missing log so future checks hit the fast path
      try {
        await setDoc(
          logRef,
          { entityId, uid, invoice_number: invoiceNumber, createdAt: serverTimestamp() },
          { merge: true }
        );
      } catch { /* non-critical */ }
      return true;
    }

    const livePersonal = await hasPersonalExpenseEntry();
    if (livePersonal) {
      try {
        await setDoc(
          logRef,
          { entityId, uid, invoice_number: invoiceNumber, createdAt: serverTimestamp() },
          { merge: true }
        );
      } catch { /* non-critical */ }
      return true;
    }

    return false; // Truly not yet processed
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
