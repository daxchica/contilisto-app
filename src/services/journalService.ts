// src/services/journalService.ts
import { db } from "../firebase-config";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import type { JournalEntry } from "../types/JournalEntry";
import { upsertPayable, applyPayablePayment } from "./payablesService";
import type { Payable } from "@/types/Payable";

/* -----------------------------------------------------------
 * Remove undefined values recursively (Firestore-safe)
 * ----------------------------------------------------------- */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as any;
  }

  if (value && typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) {
      if (v === undefined) continue; // 🔥 Firestore no acepta undefined
      out[k] = stripUndefined(v);
    }
    return out;
  }

  // Opcional: evita NaN (también puede causar problemas)
  if (typeof value === "number" && Number.isNaN(value)) {
    return 0 as any;
  }

  return value;
}

/* -----------------------------------------------------------
 * FETCH ENTRIES FOR AN ENTITY
 * ----------------------------------------------------------- */
export async function fetchJournalEntries(
  entityId: string
): Promise<JournalEntry[]> {
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
    ...new Set(entries.map((e) => (e.invoice_number || "").trim()).filter(Boolean)),
  ];

  const existing: Record<string, boolean> = {};

  for (let i = 0; i < invoiceNumbers.length; i += 10) {
    const chunk = invoiceNumbers.slice(i, i + 10);
    const qInvoice = query(colRef, where("invoice_number", "in", chunk));
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
    const id =
    typeof e.id === "string" && e.id?.trim()
      ? e.id
      : crypto.randomUUID();

    const transactionId: string = 
      typeof e.transactionId === "string" && e.transactionId.trim() 
        ? e.transactionId 
        : crypto.randomUUID();
    
    const entry: JournalEntry = {
      ...e,
      id,
      entityId,
      uid: userId,
      userId,
      transactionId,
      createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
    };

    const key = `${entry.invoice_number}-${entry.account_code}-${entry.debit}-${entry.credit}`;
    if (existing[key]) continue; // skip duplicate

    const cleanEntry = stripUndefined(entry);
    await setDoc(doc(colRef, id), cleanEntry as JournalEntry);
    saved.push(cleanEntry as JournalEntry);
  }

  // ======================================================
// CREATE / UPDATE PAYABLES (1 transactionId => 1 CxP)
// ======================================================
const normalizeAccountCode = (code: string) => code.replace(/\./g, "").trim();

// Detecta “proveedores” de forma flexible (211..., 2.01.01..., etc.)
const isSupplierPayableAccount = (accountCode?: string) => {
  if (!accountCode) return false;
  const c = normalizeAccountCode(accountCode);
  return c.startsWith("211") || c.startsWith("20101") || c.startsWith("2"); 
  // 👆 si luego quieres ser estricto, deja solo 211 / 20101
};

// 1) Filtra solo líneas que realmente crean CxP (crédito > 0)
const payableLines = saved.filter(
  (e) =>
    typeof e.transactionId === "string" &&
    e.transactionId.trim() &&
    isSupplierPayableAccount(e.account_code) &&
    Number(e.credit || 0) > 0
);

if (payableLines.length > 0) {
  // 2) Agrupa por transactionId (1 factura = 1 transacción)
  const byTx = new Map<string, JournalEntry[]>();
  for (const line of payableLines) {
    const key = line.transactionId!;
    if (!byTx.has(key)) byTx.set(key, []);
    byTx.get(key)!.push(line);
  }

  // 3) Upsert por cada transacción
  for (const [transactionId, lines] of byTx.entries()) {
    const total = Number(
      lines.reduce((sum, e) => sum + Number(e.credit || 0), 0).toFixed(2)
    );

    // Usa la primera línea como referencia (proveedor, factura, fecha)
    const ref = lines[0];

    await upsertPayable(entityId, {
      transactionId,
      invoiceNumber: (ref.invoice_number || "").trim(),
      issueDate: ref.date, // asumiendo YYYY-MM-DD
      supplierName: ref.supplier_name || ref.issuerName || "Proveedor",
      supplierRUC: ref.issuerRUC || "",
      total,

      // Defaults requeridos por tu negocio
      termsDays: 30,
      installments: 1,
      paid: 0,

      createdFrom: "ai_journal",
    });
  }
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
  const chunks: string[][] = [];
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

  const colRef = collection(db, "entities", entityId, "journalEntries");
  const batch = writeBatch(db);
  
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
export async function createPayablePaymentJournalEntry(
  entityId: string,
  payable: Payable,
  amount: number,
  paymentDate: string,
  bankAccountCode: string,
  userId: string
) {
  if (!entityId) throw new Error("entityId faltante");
  if (!payable?.id) throw new Error("payableId faltante");
  if (amount <= 0) throw new Error("Monto invalida");

  const transactionId = crypto.randomUUID();

  const entries: JournalEntry[] = [
    {
      entityId,
      transactionId,
      date: paymentDate,
      account_code: "2.01.01",
      account_name: "Proveedores",
      debit: amount,
      credit: 0,
      description: `Pago proveedor ${payable.supplierName}`,
      invoice_number: payable.invoiceNumber,
    },
    {
      entityId,
      transactionId,
      date: paymentDate,
      account_code: bankAccountCode,
      account_name: "Banco",
      debit: 0,
      credit: amount,
      description: `Pago proveedor ${payable.supplierName}`,
      invoice_number: payable.invoiceNumber,
    },
  ];

  await saveJournalEntries(entityId, entries, userId);
  await applyPayablePayment(entityId, payable, amount);
}
