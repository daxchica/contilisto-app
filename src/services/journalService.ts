// src/services/journalService.ts
import { db } from "../firebase-config";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  setDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";

import type { JournalEntry } from "../types/JournalEntry";

/* -----------------------------------------------------------
 * FETCH ENTRIES FOR AN ENTITY
 * ----------------------------------------------------------- */
export async function fetchJournalEntries(entityId: string): Promise<JournalEntry[]> {
  if (!entityId) return [];

  const colRef = collection(db, "entities", entityId, "journalEntries");
  const snap = await getDocs(colRef);

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as JournalEntry),
  }));
}

/* -----------------------------------------------------------
 * SAVE ENTRIES WITH DUPLICATE PROTECTION
 * ----------------------------------------------------------- */
export async function saveJournalEntries(
  entityId: string,
  entries: JournalEntry[],
  userId: string
): Promise<JournalEntry[]> {
  if (!entityId || !entries.length) return [];

  const colRef = collection(db, "entities", entityId, "journalEntries");

  // ======== Detect existing entries for this invoice ========
  const invoiceNumbers = [
    ...new Set(entries.map((e) => e.invoice_number).filter(Boolean)),
  ];

  const existing: Record<string, boolean> = {};

  if (invoiceNumbers.length) {
    const qInvoice = query(colRef, where("invoice_number", "in", invoiceNumbers));
    const snap = await getDocs(qInvoice);

    snap.forEach((d) => {
      const e = d.data() as JournalEntry;
      const key = `${e.invoice_number}-${e.account_code}-${e.debit}-${e.credit}`;
      existing[key] = true;
    });
  }

  // ======== Save entries =========
  const saved: JournalEntry[] = [];

  for (const e of entries) {
    const id = e.id || crypto.randomUUID();
    const transactionId = e.transactionId || crypto.randomUUID();

    const entry: JournalEntry = {
      ...e,
      id,
      entityId,
      uid: userId,
      userId,
      transactionId,
      createdAt: Date.now(),
    };

    const key = `${entry.invoice_number}-${entry.account_code}-${entry.debit}-${entry.credit}`;
    if (existing[key]) continue; // skip duplicate

    await setDoc(doc(colRef, id), entry);
    saved.push(entry);
  }

  return saved;
}

/* -----------------------------------------------------------
 * DELETE BY INVOICE NUMBER (for log cleanup)
 * ----------------------------------------------------------- */
export async function deleteJournalEntriesByInvoiceNumber(
  entityId: string,
  invoiceNumbers: string[]
): Promise<void> {
  if (!entityId || invoiceNumbers.length === 0) return;

  const colRef = collection(db, "entities", entityId, "journalEntries");

  // Firestore allows max 10 in array for "in" filter
  const chunks = [];
  for (let i = 0; i < invoiceNumbers.length; i += 10) {
    chunks.push(invoiceNumbers.slice(i, i + 10));
  }

  for (const group of chunks) {
    const q = query(colRef, where("invoice_number", "in", group));
    const snap = await getDocs(q);

    if (snap.empty) continue;

    const batch = writeBatch(db);
    snap.forEach(docSnap => batch.delete(docSnap.ref));
    await batch.commit();
  }
}

/* -----------------------------------------------------------
 * DELETE SPECIFIC ROWS BY THEIR IDS (UI: checkbox delete)
 * ----------------------------------------------------------- */
export async function deleteJournalEntriesByIds(
  entityId: string,
  ids: string[]
): Promise<void> {
  if (!entityId || !ids.length) return;

  const batch = writeBatch(db);
  const colRef = collection(db, "entities", entityId, "journalEntries");

  ids.forEach((id) => {
    batch.delete(doc(colRef, id));
  });

  await batch.commit();
}

/* -----------------------------------------------------------
 * DELETE ENTRIES BY TRANSACTION ID (rollback functionality)
 * ----------------------------------------------------------- */
export async function deleteJournalEntriesByTransactionId(
  entityId: string,
  transactionId: string
): Promise<void> {
  if (!entityId || !transactionId) return;

  const colRef = collection(db, "entities", entityId, "journalEntries");
  const qTx = query(colRef, where("transactionId", "==", transactionId));
  const snap = await getDocs(qTx);

  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));

  await batch.commit();
}