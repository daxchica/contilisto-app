import { db } from "../firebase-config";
import {
  collection,
  doc,
  deleteDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import * as pdfjsLib from "pdfjs-dist";
import "../pdfWorker";

import { extractInvoiceFromAPI } from "../services/extractInvoiceFromAPI";
import { extractInvoiceFromLayoutAPI } from "./extractInvoiceFromLayoutAPI";
import { extractTextBlocksFromPDF } from "../utils/extractTextBlocksFromPDF";

import { fetchProcessedInvoice } from "./firestoreLogService";
import {
  saveInvoiceToLocalLog,
  getProcessedInvoices as getLocalProcessed,
  logProcessedInvoice as logToLocalStorage,
} from "./localLogService";

import { JournalEntry } from "../types/JournalEntry";
import { Account } from "../types/AccountTypes";

const INCLUDE_ICE_IN_EXPENSE = true;

/**
 * Guarda asientos contables en Firestore con control de duplicados.
 */
export async function saveJournalEntries(
  entityId: string,
  entries: JournalEntry[],
  userId: string
): Promise<JournalEntry[]> {
  if (!entityId) throw new Error("❌ Missing entityId for journal entry");
  if (!userId) throw new Error("❌ Missing userId for journal entry");

  const journalRef = collection(db, "entities", entityId, "journalEntries");
  const savedEntries: JournalEntry[] = [];

  // Buscar duplicados por invoice_number
  const invoiceNumbers = [...new Set(entries.map((e) => e.invoice_number).filter(Boolean))];
  const existingEntries: Record<string, boolean> = {};

  if (invoiceNumbers.length > 0) {
    const q = query(journalRef, where("invoice_number", "in", invoiceNumbers));
    const snapshot = await getDocs(q);
    snapshot.forEach((doc) => {
      const data = doc.data() as JournalEntry;
      if (data.invoice_number) {
        const key = `${data.invoice_number}-${data.account_code}-${data.debit}-${data.credit}-${data.date}`;
        existingEntries[key] = true;
      }
    });
  }

  for (const { userId: _ignore, ...rest } of entries) {
    const id = rest.id || crypto.randomUUID();
    const fullEntry: JournalEntry = {
      ...rest,
      entityId,
      userId,
      id,
      createdAt: Date.now(),
      debit: typeof rest.debit === "number" ? rest.debit : 0,
      credit: typeof rest.credit === "number" ? rest.credit : 0,
      description: rest.description || "",
      invoice_number: rest.invoice_number || "",
      account_code: rest.account_code || "",
      account_name: rest.account_name || "",
      date: rest.date || new Date().toISOString().slice(0, 10),
    };

    const duplicateKey = `${fullEntry.invoice_number}-${fullEntry.account_code}-${fullEntry.debit}-${fullEntry.credit}-${fullEntry.date}`;
    if (existingEntries[duplicateKey]) {
      console.warn(`[⛔️ Duplicado detectado] Saltando asiento: ${duplicateKey}`);
      continue;
    }

    const docRef = doc(journalRef, id);
    await setDoc(docRef, fullEntry);
    savedEntries.push(fullEntry);
  }

  // Fixed: Registrar facturas procesadas despues de guardar exitosamente
  const uniqueInvoices = new Set(
    savedEntries
      .map((e) => e.invoice_number)
      .filter((inv): inv is string => Boolean(inv?.trim()))
  );

  for (const invoiceNumber of uniqueInvoices) {
    try {
      saveInvoiceToLocalLog(entityId, invoiceNumber);
      console.log(`Factura registrada en Log: ${invoiceNumber}`);
    } catch (logErr) {
      console.error(`Error registrando factura ${invoiceNumber}:`, logErr);
    }
  }

  return savedEntries;
}

/**
 * Obtiene todos los asientos contables para una entidad.
 */
export async function fetchJournalEntries(entityId: string): Promise<JournalEntry[]> {
  if (!entityId) {
    console.warn(" fetchJournalEntries called without entityId");
    return [];
  }

  const journalRef = collection(db, "entities", entityId, "journalEntries");
  const snapshot = await getDocs(journalRef);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as JournalEntry[];
}

/**
 * Devuelve el set de invoice_number ya procesados.
 */
export async function getAlreadyProcessedInvoiceNumbers(entityId: string): Promise<Set<string>> {
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

/**
 * Procesa un archivo PDF y extrae los asientos contables desde IA o LayoutAI.
 */
export async function parsePDF(
  
  file: File,
  userRUC: string,
  entityId: string,
  userId: string,
  entityType: string,
  useLayoutAI: boolean = false
): Promise<JournalEntry[]> {
  console.log("parsePDF() fue llamado con archivo:", file.name);

  if (!file || !userRUC || !entityId || !userId || !entityType) {
    throw new Error("❌ Faltan parámetros obligatorios en parsePDF");
  }

  const transactionId = `TX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  
  const processedInvoices = await getAlreadyProcessedInvoiceNumbers(entityId);
  const entries: JournalEntry[] = [];

  try {
    if (useLayoutAI) {
      const blocks = await extractTextBlocksFromPDF(file);
      const aiEntries = await extractInvoiceFromLayoutAPI(blocks, userRUC, entityType);

      const newOnly = aiEntries.filter(
        (e) => e.invoice_number && !processedInvoices.has(e.invoice_number)
      );

      if (newOnly.length > 0) {
        entries.push(...newOnly.map((e) => ({ 
          ...e, 
          transactionId, 
          userId,
        entityId 
      })));
      console.log(`Extraidos ${newOnly.length} asientos nuevos (LayoutAI)`);
      } else {
        console.warn("📭 Factura ya procesada anteriormente (LayoutAI)");
      }
    } else {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += " " + (content.items as any[]).map((item: any) => item.str).join(" ");
      }

      const aiEntries = await extractInvoiceFromAPI(fullText, userRUC, entityType);

      const newOnly = aiEntries.filter(
        (e) => e.invoice_number && !processedInvoices.has(e.invoice_number)
      );

      if (newOnly.length > 0) {
        entries.push(...newOnly.map((e) => ({ 
          ...e, 
          transactionId, 
          userId,
          entityId 
        })));
        console.log(`Extraidos ${newOnly.length} asientos nuevos (OCR)`);
      } else {
        console.warn("📭 Factura ya procesada anteriormente (OCR)");
      }
    }
  } catch (err) {
    console.error("❌ Error durante la extracción IA:", err);
    throw err;
  }

  return entries;
}

/**
 * Elimina todos los registros con un mismo transactionId.
 */
export async function deleteJournalEntriesByTransactionId(
  entityId: string, 
  transactionId: string
) {
  const qy = query(
    collection(db, "entities", entityId, "journalEntries"),
    where("transactionId", "==", transactionId)
  );
  const snapshot = await getDocs(qy);
  await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
}

/**
 * Elimina registros por invoice_number.
 */
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

  console.log(`Eliminados ${snap.size} asientos con facturas:`, invoiceNumbers);
}

/**
 * Crea un único asiento contable.
 */
export async function createJournalEntry(
  entry: JournalEntry & { entityId: string; userId: string }
): Promise<JournalEntry> {
  const saved = await saveJournalEntries(entry.entityId, [entry], entry.userId);
  return saved[0];
}

/**
 * Elimina múltiples registros por sus IDs.
 */
export async function deleteJournalEntriesByIds(
  entryIds: string[],
  entityId: string,
  uid: string
): Promise<void> {
  if (!entityId) throw new Error("❌ Missing entityId for deleteJournalEntriesByIds");
  if (!uid) throw new Error("❌ Missing user uid for deleteJournalEntriesByIds");
  if (!entryIds || entryIds.length === 0) {
    console.warn("⚠️ No se proporcionaron IDs para eliminar");
    return;
  }

  try {
    const BATCH_SIZE = 450;
    for (let i = 0; i < entryIds.length; i += BATCH_SIZE) {
      const chunk = entryIds.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      
      chunk.forEach((id) => {
        if (!id) return;
        const entryRef = doc(db, "entities", entityId, "journalEntries", id);
        batch.delete(entryRef);
      });
      
      await batch.commit();
    }

    console.log(`🧹 ${entryIds.length} asientos eliminados de Firestore.`);
  } catch (err) {
    console.error("❌ Error al eliminar entradas:", err);
    throw Error("Error eliminando registros de Firestore");
  }
}