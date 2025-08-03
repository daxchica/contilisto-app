// src/services/journalService.ts

import { db } from "../firebase-config";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
} from "firebase/firestore";
import * as pdfjsLib from "pdfjs-dist";
import "../pdfWorker";

import { extractInvoiceDataWithAI_gpt4o } from "../ai/extractInvoiceDataWithAI_gpt4o";
import { logProcessedInvoice as logToFirestore } from "./firestoreLogService";
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
  if (!userId) throw new Error("Missing userId for journal entry");
  const journalRef = collection(db, "entities", entityId, "journalEntries");
  
  const ops = entries.map(({ userId: _, ...rest }) => {
    const fullEntry = { ...rest, userId };
    console.log("Intentando guardar:", fullEntry);
    return addDoc(journalRef, fullEntry);
  });

  await Promise.all(ops);
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

function normalizeAmount(value: string): number {
  if (/^\d{10,}$/.test(value.replace(/\D/g, ""))) {
    console.warn(`⚠️ Suspicious number skipped: ${value}`);
    return 0;
  }
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function matchOr(text: string, ...regexes: RegExp[]): number {
  for (const regex of regexes) {
    const match = text.match(regex);
    if (match?.[1]) {
      console.log(`✔️ Match found with: ${regex}`);
      return normalizeAmount(match[1]);
    }
  }
  return 0;
}

function createEntry(
  type: "debit" | "credit",
  amount: number,
  code: string,
  name: string,
  entryType: "income" | "expense",
  invoice_number?: string,
  transactionId?: string
): JournalEntry {
  return {
    date: new Date().toISOString().split("T")[0],
    description: name,
    account_code: code,
    account_name: name,
    [type]: amount,
    type: entryType,
    invoice_number,
    transactionId,
  };
}

function extractInvoiceDataRegex(
  text: string,
  userRUC: string,
  transactionId?: string
): JournalEntry[] {
  const cleanText = text.replace(/\s+/g, " ").trim();
  const rucMatches = Array.from(new Set(cleanText.match(/\b\d{13}\b/g) || []));
  const issuerRUC = rucMatches.find((r) => r !== userRUC);
  const type: "income" | "expense" = issuerRUC === userRUC ? "income" : "expense";
  if (!issuerRUC || !userRUC || type === "income") return [];

  const regexMap = {
    subtotal: /([\d.,]+)\s+SUBTOTAL\s+12%/i,
    subtotalAlt: /([\d.,]+)\s+SUBTOTAL\s+SIN\s+IMPUESTOS/i,
    ice: /ICE\s+([\d.,]+)/i,
    iva: /\bIVA\s+12%\s*[:\-]?\s*([\d.,]+)/i,
    total: /\bVALOR\s+TOTAL(?:\s+SIN\s+SUBSIDIO)?\s*[:\-]?\s*([\d.,]+)/i,
  };

  const subtotal = matchOr(cleanText, regexMap.subtotal, regexMap.subtotalAlt);
  const ice = matchOr(cleanText, regexMap.ice);
  const iva = matchOr(cleanText, regexMap.iva);
  const total = matchOr(cleanText, regexMap.total);

  if (subtotal === 0 && total === 0) return [];
  const invoice_number = cleanText.match(/\b\d{3}-\d{3}-\d{9}\b/)?.[0]?.trim();
  const entries: JournalEntry[] = [];
  const cost = total - iva - ice;

  if (cost > 0) entries.push(createEntry("debit", cost, "5XXXX", "Compras", type, invoice_number, transactionId));
  if (ice > 0 && INCLUDE_ICE_IN_EXPENSE) entries.push(createEntry("debit", ice, "5XXX1", "Gastos ICE", type, invoice_number, transactionId));
  if (iva > 0) entries.push(createEntry("debit", iva, "2XXXX", "IVA por pagar", type, invoice_number, transactionId));
  entries.push(createEntry("credit", total, "1XXXX", "Cuentas por pagar", type, invoice_number, transactionId));

  return entries;
}

export async function parsePDF(
  file: File,
  userRUC: string,
  entityId: string,
  userId: string
): Promise<JournalEntry[]> {
  if (!file || !userRUC || !entityId || !userId) throw new Error("Missing parameter");

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += " " + content.items.map((item: any) => item.str).join(" ");
  }

  const transactionId = `TX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const allProcessed = new Set([
    ...(await getAlreadyProcessedInvoiceNumbers(entityId)),
    ...getLocalProcessed(userRUC),
  ]);

  const entries: JournalEntry[] = [];
  try {
    const aiEntries = await extractInvoiceDataWithAI_gpt4o(fullText, userRUC);
    const newOnly = aiEntries.filter(e => e.invoice_number && !allProcessed.has(e.invoice_number));
    if (newOnly.length > 0) entries.push(...newOnly.map(e => ({ ...e, transactionId, userId })));
    else return [];
  } catch (err) {
    console.error("AI extraction failed, falling back to regex", err);
    const regexEntries = extractInvoiceDataRegex(fullText, userRUC, transactionId).filter(
      e => e.invoice_number && !allProcessed.has(e.invoice_number)
    );
    if (regexEntries.length === 0) return [];
    entries.push(...regexEntries.map(e => ({ ...e, userId })));
  }

  await Promise.all(
    entries.map(e =>
      logToFirestore(entityId, e.invoice_number!).catch(err =>
        console.error(`Error logging invoice ${e.invoice_number}`, err)
      )
    )
  );

  entries.forEach(e => logToLocalStorage(userRUC, e.invoice_number!));
  console.log("Entradas a guardar:", entries.map(e => ({ invoice: e.invoice_number, userId: e.userId })));
  await saveJournalEntries(entityId, entries, userId);

  return entries;
}

export async function deleteJournalEntriesByTransactionId(
  entityId: string,
  transactionId: string
) {
  const q = query(collection(db, "entities", entityId, "journalEntries"), where("transactionId", "==", transactionId));
  const snapshot = await getDocs(q);
  await Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));
}

export async function deleteJournalEntriesByInvoiceNumber(
  entityId: string,
  invoiceNumbers: string[]
): Promise<void> {
  if (!entityId || invoiceNumbers.length === 0) return;

  const journalRef = collection(db, "entities", entityId, "journalEntries");
  for (const invoiceNumber of invoiceNumbers) {
    const q = query(journalRef, where("invoice_number", "==", invoiceNumber));
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
  }
}

export async function createJournalEntry(entry: JournalEntry & { entityId: string; userId: string }) {
  await saveJournalEntries(entry.entityId, [entry], entry.userId);
}
/**
 * Saves an array of journal entries for a specific entity to Firestore.
 * Each entry is saved individually using `addDoc`, and associated with the authenticated user.
 * 
 * This method is preferred in low- to medium-volume usage because:
 * - It avoids batching complexity.
 * - It allows logging and inspection per-entry.
 * - It works well for systems with fewer than ~500 writes/minute.
 * 
 * @param entityId - Firestore document ID of the entity.
 * @param entries - Array of journal entries to be saved.
 * @param userId - UID of the authenticated user saving the entries.
 * 
 * @throws Will throw an error if `userId` is missing.
 */