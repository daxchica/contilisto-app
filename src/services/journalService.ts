// src/services/journalService.ts
import { db } from "../firebase-config";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import * as pdfjsLib from "pdfjs-dist";
import "../pdfWorker";

import { extractInvoiceFromAPI } from "../ai/extractInvoiceFromAPI";
import { extractInvoiceFromLayoutAPI } from "./extractInvoiceFromLayoutAPI";
import { extractTextBlocksFromPDF } from "../utils/extractTextBlocksFromPDF";

import { ProcessedInvoice as logToFirestore } from "./firestoreLogService";
import {
  logProcessedInvoice as logToLocalStorage,
  getProcessedInvoices as getLocalProcessed,
} from "./localLogService";
import { JournalEntry } from "../types/JournalEntry";

const INCLUDE_ICE_IN_EXPENSE = true;

export async function saveJournalEntries(
  entityId: string,
  entries: JournalEntry[],
  userId: string
) {
  if (!entityId) throw new Error("Missing entityId for journal entry");
  if (!userId) throw new Error("Missing userId for journal entry");

  const journalRef = collection(db, "entities", entityId, "journalEntries");
 
  for (const { userId: _ignored, ...rest } of entries) {
    const fullEntry = {
      ...rest,
      entityId,
      userId,
      createdAt: serverTimestamp(),

      // 🔐 Garantiza valores válidos
      debit: typeof rest.debit === "number" ? rest.debit : 0,
      credit: typeof rest.credit === "number" ? rest.credit : 0,
      description: rest.description || "",
      invoice_number: rest.invoice_number || "",
      account_code: rest.account_code || "",
      account_name: rest.account_name || "",
      date: rest.date || new Date().toISOString().slice(0, 10),
    };
    await addDoc(journalRef, fullEntry);
  }
}

export async function fetchJournalEntries(
  entityId: string
): Promise<JournalEntry[]> {
  const journalRef = collection(db, "entities", entityId, "journalEntries");
  const snapshot = await getDocs(journalRef);
  return snapshot.docs.map((doc) => doc.data() as JournalEntry);
}

export async function getAlreadyProcessedInvoiceNumbers(
  entityId: string
): Promise<Set<string>> {
  const journalRef = collection(db, "entities", entityId, "journalEntries");
  const snapshot = await getDocs(journalRef);

  const invoiceSet = new Set<string>();
  snapshot.forEach((doc) => {
    const { invoice_number } = doc.data();
    if (typeof invoice_number === "string" && invoice_number.trim()) {
      invoiceSet.add(invoice_number.trim());
    }
  });
  return invoiceSet;
}

export async function parsePDF(
  file: File,
  userRUC: string,
  entityId: string,
  userId: string,
  useLayoutAI: boolean = false
): Promise<JournalEntry[]> {
  if (!file || !userRUC || !entityId || !userId) throw new Error("Missing parameter");

  const transactionId = `TX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const allProcessed = new Set([
    ...(await getAlreadyProcessedInvoiceNumbers(entityId)),
    ...getLocalProcessed(userRUC),
  ]);

  const entries: JournalEntry[] = [];

  try {
    if (useLayoutAI) {
      const blocks = await extractTextBlocksFromPDF(file);
      const aiEntries = await extractInvoiceFromLayoutAPI(blocks, userRUC);
      const newOnly = aiEntries.filter(e => e.invoice_number && !allProcessed.has(e.invoice_number));
      if (newOnly.length > 0) entries.push(...newOnly.map(e => ({ ...e, transactionId, userId })));
      else return [];
    } else {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += " " + (content.items as any[]).map((item: any) => item.str).join(" ");
      }

      const aiEntries = await extractInvoiceFromAPI(fullText, userRUC);
      const newOnly = aiEntries.filter(e => e.invoice_number && !allProcessed.has(e.invoice_number));
      if (newOnly.length > 0) entries.push(...newOnly.map(e => ({ ...e, transactionId, userId })));
      else return [];
    }
  } catch (err) {
    console.error("AI extraction failed", err);
    return [];
  }

  await Promise.all(
    entries.map(e =>
      logToFirestore(entityId, e.invoice_number!).catch(err =>
        console.error(`Error logging invoice ${e.invoice_number}`, err)
      )
    )
  );
  entries.forEach(e => logToLocalStorage(userRUC, e.invoice_number!));

  return entries;
}

export async function deleteJournalEntriesByTransactionId(
  entityId: string,
  transactionId: string
) {
  const qy = query(collection(db, "entities", entityId, "journalEntries"), where("transactionId", "==", transactionId));
  const snapshot = await getDocs(qy);
  await Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));
}

/** 🔧 Batch deletes using IN (chunks of 10) to be efficient and avoid many roundtrips */
export async function deleteJournalEntriesByInvoiceNumber(
  entityId: string,
  invoiceNumbers: string[]
): Promise<void> {
  if (!entityId || invoiceNumbers.length === 0) return;

  const colRef = collection(db, "entities", entityId, "journalEntries");
  const chunks: string[][] = [];
  for (let i = 0; i < invoiceNumbers.length; i += 10) {
    chunks.push(invoiceNumbers.slice(i, i + 10));
  }

  for (const inChunk of chunks) {
    const qy = query(colRef, where("invoice_number", "in", inChunk));
    const snap = await getDocs(qy);
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function createJournalEntry(entry: JournalEntry & { entityId: string; userId: string }) {
  await saveJournalEntries(entry.entityId, [entry], entry.userId);
}
