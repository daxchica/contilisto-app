// src/services/journalService.ts
import { db } from "../firebase-config";
import {
  addDoc,
  collection,
  doc,
  deleteDoc,
  getDocs,
  query,
  setDoc,
  where,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import * as pdfjsLib from "pdfjs-dist";
import "../pdfWorker";

import { extractInvoiceFromAPI } from "../ai/extractInvoiceFromAPI";
import { extractInvoiceFromLayoutAPI } from "./extractInvoiceFromLayoutAPI";
import { extractTextBlocksFromPDF } from "../utils/extractTextBlocksFromPDF";

import { fetchProcessedInvoice } from "./firestoreLogService";
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
): Promise<JournalEntry[]> {
  if (!entityId) throw new Error("Missing entityId for journal entry");
  if (!userId) throw new Error("Missing userId for journal entry");

  const journalRef = collection(db, "entities", entityId, "journalEntries");
  const savedEntries: JournalEntry[] = [];

  for (const { userId: _ignored, ...rest } of entries) {
    const id = rest.id || crypto.randomUUID();
    const fullEntry = {
      ...rest,
      entityId,
      userId,
      createdAt: Date.now(),
      debit: typeof rest.debit === "number" ? rest.debit : 0,
      credit: typeof rest.credit === "number" ? rest.credit : 0,
      description: rest.description || "",
      invoice_number: rest.invoice_number || "",
      account_code: rest.account_code || "",
      account_name: rest.account_name || "",
      date: rest.date || new Date().toISOString().slice(0, 10),
    };

    const docRef = doc(journalRef, id);
    await setDoc(docRef, fullEntry);
    savedEntries.push(fullEntry);
  }

  return savedEntries;
}

export async function fetchJournalEntries(
  entityId: string
): Promise<JournalEntry[]> {
  const journalRef = collection(db, "entities", entityId, "journalEntries");
  const snapshot = await getDocs(journalRef);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as JournalEntry[];
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
      fetchProcessedInvoice(entityId, e.invoice_number!).catch(err =>
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
  const qy = query(
    collection(db, "entities", entityId, "journalEntries"),
    where("transactionId", "==", transactionId)
  );
  const snapshot = await getDocs(qy);
  await Promise.all(snapshot.docs.map(docSnap => deleteDoc(docSnap.ref)));
}

export async function deleteJournalEntriesByInvoiceNumber(
  entityId: string,
  invoiceNumbers: string[]
): Promise<void> {
  if (!entityId || invoiceNumbers.length === 0) return;

  const colRef = collection(db, "entities", entityId, "journalEntries");
  const q = query(colRef, where("invoice_number", "in", invoiceNumbers));
  const snap = await getDocs(q);

  const deletions = snap.docs.map((docRef) => deleteDoc(docRef.ref));
  await Promise.all(deletions);
}

export async function createJournalEntry(entry: JournalEntry & { entityId: string; userId: string }) {
  const saved = await saveJournalEntries(entry.entityId, [entry], entry.userId);
  return saved[0];
}

export async function deleteJournalEntriesByIds(
  entryIds: string[],
  entityId: string,
  uid: string,
): Promise<void> {
  if (!entityId) throw new Error("Missing entityId for deleteJournalEntriesByIds");
  if (!uid) throw new Error("Missing user uid for deleteJournalEntriesByIds");
  if (!entryIds || entryIds.length === 0) {
    console.warn("No se proporcionaron IDs para eliminar");
   return;
  }

  try {
    console.log("Eliminando IDs:", entryIds, "para la entidad:", entityId);

    const journalPath = `entities/${entityId}/journalEntries`;
    const colRef = collection(db, journalPath);

    // Comprobamos qué documentos existen realmente en Firestore antes de eliminarlos
    const allDocs = await getDocs(colRef);
    const allIds = allDocs.docs.map((d) => d.id);
    console.log("📦 Documentos actualmente en Firestore:", allIds);

    const BATCH_SIZE = 450;

    for (let i = 0; i < entryIds.length; i += BATCH_SIZE) {
      const chunk = entryIds.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((id) => {
        if (!id) return;
        const entryRef = doc(db, "entities", entityId, "journalEntries", id);
        console.log("Eliminando:", entryRef.path);
        batch.delete(entryRef);
      });
      await batch.commit();
    }
    console.log(`${entryIds.length} asientos eliminados de Firestore.`);
  } catch (err) {
    console.error("Error al eliminar entradas:", err);
    throw Error("Error eliminando registros de Firestore");
  }
}