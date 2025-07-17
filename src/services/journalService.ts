// services/journalService.ts

import { db } from "../firebase-config";
import { collection, addDoc, getDocs, query, where, deleteDoc } from "firebase/firestore";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { extractInvoiceDataWithAI_gpt4 } from "../ai/extractInvoiceDataWithAI_gpt4";
import { extractInvoiceDataWithAI_gpt4o } from "../ai/extractInvoiceDataWithAI_gpt4o";
import { logProcessedInvoice as logToFirestore } from "./firestoreLogService";
import { 
  logProcessedInvoice as logToLocalStorage, 
  getProcessedInvoices as getLocalProcessed 
} from "./localLogService";
import { parsePDF } from "../services/journalService";


pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const INCLUDE_ICE_IN_EXPENSE = true;

export interface JournalEntry {
  date: string;
  description: string;
  account_code: string;
  account_name: string;
  debit?: number;
  credit?: number;
  type?: "income" | "expense";
  invoice_number?: string;
  transactionId?: string;
}

export async function saveJournalEntries(entityId: string, entries: JournalEntry[]) {
  const journalRef = collection(db, "entities", entityId, "journalEntries");
  const saveOps = entries.map(entry => addDoc(journalRef, entry));
  await Promise.all(saveOps);
}

export async function fetchJournalEntries(entityId: string): Promise<JournalEntry[]> {
  const journalRef = collection(db, "entities", entityId, "journalEntries");
  const snapshot = await getDocs(journalRef);
  return snapshot.docs.map(doc => doc.data() as JournalEntry);
}

export async function getAlreadyProcessedInvoiceNumbers(entityId: string): Promise<Set<string>> {
  const journalRef = collection(db, "entities", entityId, "journalEntries");
  const snapshot = await getDocs(journalRef);

  const invoiceSet = new Set<string>();
  snapshot.forEach(doc => {
    const data = doc.data();
    if (typeof data.invoice_number === "string" && data.invoice_number.trim()) {
      invoiceSet.add(data.invoice_number.trim());
    }
  });
  return invoiceSet;
}

function normalizeAmount(value: string): number {
  if (/^\d{10,}$/.test(value.replace(/\D/g, ""))) {
    console.warn(`⚠️ Suspicious number skipped: ${value}`);
    return 0;
  }
  const cleaned = value
  .replace(/[^\d,.-]/g, "")
  .replace(/\.(?=\d{3})/g, "")
  .replace(",", ".");
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
  userRUC: string
): JournalEntry[] {
  const cleanText = text.replace(/\s+/g, " ").trim();
  const rucMatches = Array.from(new Set(cleanText.match(/\b\d{13}\b/g) || []));
  const issuerRUC = rucMatches.find(r => r !== userRUC);
  const isIncome = issuerRUC === userRUC;
  const type: "income" | "expense" = isIncome ? "income" : "expense";
  if (!issuerRUC || !userRUC || isIncome) return [];

  const regexMap = {
    subtotal: /([\d.,]+)\s+SUBTOTAL\s+12%/i,
    subtotalAlt: /([\d.,]+)\s+SUBTOTAL\s+SIN\s+IMPUESTOS/i,
    ice: /ICE\s+([\d.,]+)/i,
    iva: /\bIVA\s+12%\s*[:\-]?\s*([\d.,]+)/i,
    total: /\bVALOR\s+TOTAL(?:\s+SIN\s+SUBSIDIO)?\s*[:\-]?\s*([\d.,]+)/i
  };

  const subtotal = matchOr(cleanText, regexMap.subtotal, regexMap.subtotalAlt);
  const ice = matchOr(cleanText, regexMap.ice);
  const iva = matchOr(cleanText, regexMap.iva);
  const total = matchOr(cleanText, regexMap.total);

  console.log("Parsed amounts [regex]", { subtotal, ice, iva, total });

  if (subtotal === 0 && total === 0) {
    console.warn("⚠️ Skipping: No valid amount found", { 
      subtotal, 
      ice, 
      iva, 
      total 
    });
    return [];
  }

  const invoiceMatch = cleanText.match(/\b\d{3}-\d{3}-\d{9}\b/);
  const invoice_number = invoiceMatch?.[0]?.trim();
  
  const entries: JournalEntry[] = [];
  const cost = total - iva - ice;

  if (cost > 0) 
    entries.push(
      createEntry("debit", cost, "5XXXX", "Compras", type, invoice_number, transactionId)
    );
  if (ice > 0 && INCLUDE_ICE_IN_EXPENSE) 
    entries.push(
      createEntry("debit", ice, "5XXX1", "Gastos ICE", type, invoice_number, transactionId)
    );
  if (iva > 0) 
    entries.push(
      createEntry("debit", iva, "2XXXX", "IVA por pagar", type, invoice_number, transactionId)
    );
  entries.push(
    createEntry("credit", total, "1XXXX", "Cuentas por pagar", type, invoice_number, transactionId)
  );

  return entries;
}

export async function parsePDF(
  file: File,
  userRUC: string,
  entityId: string,
): Promise<JournalEntry[]> {
  if (!file) throw new Error("Missing parameter: file");
  if (!userRUC) throw new Error("Missing parameter: userRUC");
  if (!entityId) throw new Error("Missing parameter: entityId");

  const entries: JournalEntry[] = [];
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => item.str).join(" ");
    fullText += " " + text;
  }

  const transactionId = `TX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const firebaseProcessed = await getAlreadyProcessedInvoiceNumbers(entityId);
  const localProcessed = new Set(getLocalProcessed(userRUC));
  const allProcessed = new Set([...firebaseProcessed, ...localProcessed]);
  
  const invoiceMatch = fullText.match(/\b\d{3}-\d{3}-\d{9}\b/);
  const fallbackInvoiceNumber = invoiceMatch?.[0]?.trim();

  try {
    const aiEntries = await extractInvoiceDataWithAI_gpt4o(fullText, userRUC);
    const newOnly = aiEntries.filter(
      (e) => e.invoice_number && !allProcessed.has(e.invoice_number)
    );

    if (newOnly.length > 0) {
      const enriched = newOnly.map((e) => ({
        ...e,
        transactionId
      }));
      entries.push(...enriched);
    } else {
      console.warn("❌ No new entries from GPT-4o. Aborting parse for this file.");
      return [];
    }
  } catch (err) {
    console.error("❌ AI extraction failed. Fallback to regex.", err);
    const regexEntries = extractInvoiceDataRegex(fullText, userRUC, transactionId);
    const regexNew = regexEntries.filter(
      (e) => e.invoice_number && !allProcessed.has(e.invoice_number)
    );
    if (regexNew.length > 0) {
      entries.push(...regexNew);
  } else {
      console.warn("⚠️ Invoice appears already processed:", fallbackInvoiceNumber);
      return [];
    }
  }

  // ✅ Registrar facturas procesadas
  for (const entry of entries) {
    if (entry.invoice_number) {
      await logToFirestore(entityId, entry.invoice_number);
      logToLocalStorage(userRUC, entry.invoice_number);
    }
  }

  return entries;
}

export async function deleteJournalEntriesByTransactionId(
  entityId: string, 
  transactionId: string
) {
  const journalRef = collection(db, "entities", entityId, "journalEntries");
  const q = query(journalRef, where("transactionId", "==", transactionId));
  const snapshot = await getDocs(q);

  const deleteOps = snapshot.docs.map((doc) => deleteDoc(doc.ref));
  await Promise.all(deleteOps);
  console.log(
    `🗑️ Deleted ${deleteOps.length} journal entries for transactionId: ${transactionId}`
  );
}

export async function deleteJournalEntriesByInvoiceNumber(
  entityId: string, 
  invoiceNumbers: string[]
): Promise<void> {
  if (!entityId || invoiceNumbers.length === 0) return;

  const journalRef = collection(db, "entities", entityId, "journal");

  for (const invoiceNumber of invoiceNumbers) {
    const q = query(journalRef, where("invoice_number", "==", invoiceNumber));
    const snapshot = await getDocs(q);

    const deletions = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
    await Promise.all(deletions);
    console.log(`🗑️ Deleted ${deletions.length} journal entries for invoice: ${invoiceNumber}`);
  }
}