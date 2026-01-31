// ============================================================================
// src/services/journalService.ts
// CONTILISTO — Journal Service (Upgraded / AP+AR Sync Safe)
// ============================================================================

import { db } from "@/firebase-config";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

import type { JournalEntry } from "@/types/JournalEntry";
import type { Payable } from "@/types/Payable";

import { upsertPayable, applyPayablePayment } from "./payablesService";
import { upsertReceivable } from "./receivablesService";
import {
  createBankMovement,
  linkJournalTransaction,
} from "./bankMovementService";

/* =============================================================================
   HELPERS
============================================================================= */

/**
 * Removes undefined recursively without destroying Firestore special values
 * (Timestamp / FieldValue / etc).
 */
function stripUndefined<T>(value: T): T {
  // Keep Firestore Timestamp / FieldValue / sentinel objects intact.
  if (value && typeof value === "object") {
    const anyV = value as any;
    const ctor = anyV?.constructor?.name;
    if (ctor === "Timestamp" || ctor === "FieldValue") return value;
    if (typeof anyV?.toDate === "function") return value; // Timestamp-like
  }

  if (Array.isArray(value)) return value.map(stripUndefined) as any;

  if (value && typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out;
  }

  return value;
}

const norm = (c?: string) => (c || "").replace(/\./g, "").trim();

const n2 = (x: any) =>
  Number.isFinite(Number(x)) ? Number(Number(x).toFixed(2)) : 0;

/* =============================================================================
   CONTROL ACCOUNT HELPERS (ROBUST)
============================================================================= */

/**
 * Ecuador COA typical:
 * - 113... = Cuentas por Cobrar (Clientes)
 * - 114... = CxC relacionadas (optional)
 *
 * Payables:
 * - 201..., 211... (proveedores / obligaciones)
 */
const RECEIVABLE_PREFIXES = ["1020901", "113", "1301"];
const PAYABLE_PREFIXES = ["201", "211"];

function isCustomerReceivableAccount(code?: string) {
  const c = norm(code);
  return RECEIVABLE_PREFIXES.some((p) => c.startsWith(p));
}

function isSupplierPayableAccount(code?: string) {
  const c = norm(code);
  return PAYABLE_PREFIXES.some((p) => c.startsWith(p));
}

function duplicateKey(e: JournalEntry) {
  // Include date to reduce accidental collisions when invoice number repeats.
  const d = (e as any).date ?? "";
  return `${e.entityId}::${e.invoice_number}::${e.account_code}::${e.debit}::${e.credit}::${d}`;
}

function resolveInvoiceNumber(e: JournalEntry) {
  if (e.invoice_number?.trim()) return e.invoice_number.trim();
  if (!e.transactionId) {
    throw new Error("Asiento manual sin invoice_number requiere transactionId");
  }
  return `MANUAL-${e.transactionId}`;
}

function resolveDescription(e: JournalEntry): string {
  if (e.description?.trim()) return e.description.trim();
  if (e.invoice_number) return `Factura ${e.invoice_number}`;
  return "Asiento contable";
}

/* --- Safe accessors (JournalEntry may not define these yet) --- */

function getCustomerRUC(e: JournalEntry): string {
  const anyE = e as any;
  return String(anyE.customerRUC ?? anyE.customer_ruc ?? "").trim();
}

function getCustomerName(e: JournalEntry): string {
  const anyE = e as any;
  return String(anyE.customer_name ?? anyE.customerName ?? "").trim();
}

/* =============================================================================
   FETCH
============================================================================= */

export async function fetchJournalEntries(entityId: string) {
  if (!entityId) return [];

  const col = collection(db, "entities", entityId, "journalEntries");

  try {
    const snap = await getDocs(col);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as JournalEntry) }));
  } catch (err) {
    console.warn("fetchJournalEntries blocked:", err);
    return [];
  }
}

export async function fetchJournalEntriesByTransactionId(
  entityId: string,
  transactionId: string
): Promise<JournalEntry[]> {
  if (!entityId || !transactionId) return [];

  const col = collection(db, "entities", entityId, "journalEntries");
  const qTx = query(col, where("transactionId", "==", transactionId));
  const snap = await getDocs(qTx);

  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as JournalEntry) }));
}

/* =============================================================================
   INTERNAL SYNC (Journal → AP / AR)
   Notes:
   - We compute totals from the CONTROL line (not sum) to avoid double counting.
   - We never silently drop AR/AP; we use safe fallbacks where needed.
============================================================================= */

const DEFAULT_TERMS_DAYS = 30;
const DEFAULT_INSTALLMENTS = 1;

// Ecuador "Consumidor Final" (SRI): 9999999999999
const CONSUMIDOR_FINAL_ID = "9999999999999";
const CONSUMIDOR_FINAL_NAME = "CONSUMIDOR FINAL";

async function syncPayablesFromJournal(entityId: string, saved: JournalEntry[]) {
  // Only consider credit lines (payable control lives on credit side)
  const lines = saved.filter((e) => n2(e.credit) > 0);

  const grouped = new Map<string, JournalEntry[]>();
  for (const e of lines) {
    if (!e.transactionId) continue;
    if (!grouped.has(e.transactionId)) grouped.set(e.transactionId, []);
    grouped.get(e.transactionId)!.push(e);
  }

  for (const [tx, group] of grouped) {
    const control = group.find((e) => isSupplierPayableAccount(e.account_code));
    if (!control) continue;

    const total = n2(control.credit);
    if (total <= 0) continue;

    if (!control.invoice_number?.trim()) {
      console.warn(`[AP SYNC] tx=${tx} missing invoice_number`);
      continue;
    }

    const supplierName = (control as any).supplier_name?.trim() || "Proveedor";
    const supplierRUC = String((control as any).issuerRUC ?? "").trim();

    if (!control.account_code?.trim()) {
      console.warn(`[AP SYNC] tx=${tx} missing payable account_code`);
      continue;
    }

    await upsertPayable(entityId, {
      transactionId: tx,
      invoiceNumber: control.invoice_number.trim(),
      issueDate: (control as any).date,

      supplierName,
      supplierRUC,

      account_code: control.account_code,
      account_name: control.account_name || "Proveedores",

      total,
      paid: 0,

      termsDays: DEFAULT_TERMS_DAYS,
      installments: DEFAULT_INSTALLMENTS,

      createdFrom: "ai_journal",
    });
  }
}

async function syncReceivablesFromJournal(
  entityId: string, 
  saved: JournalEntry[]
) {
  // Only consider debit lines (receivable control lives on debit side)
  const lines = saved.filter((e) => n2(e.debit) > 0);

  const grouped = new Map<string, JournalEntry[]>();
  for (const e of lines) {
    if (!e.transactionId) continue;
    if (!grouped.has(e.transactionId)) grouped.set(e.transactionId, []);
    grouped.get(e.transactionId)!.push(e);
  }

  for (const [tx, group] of grouped) {
    const control = group.find((e) => isCustomerReceivableAccount(e.account_code));
    if (!control) continue;

    const total = n2(control.debit);
    if (total <= 0) continue;

    if (!control.invoice_number?.trim()) {
      console.warn(`[AR SYNC] tx=${tx} missing invoice_number`);
      continue;
    }

    if (!control.account_code?.trim()) {
      console.warn(`[AR SYNC] tx=${tx} missing receivable account_code`);
      continue;
    }

    const customerName =
      getCustomerName(control) || CONSUMIDOR_FINAL_NAME;
    
    const customerRUC =
      getCustomerRUC(control) || CONSUMIDOR_FINAL_ID;

    await upsertReceivable(entityId, {
      transactionId: tx,
      invoiceNumber: control.invoice_number.trim(),
      issueDate: (control as any).date,

      customerName,
      customerRUC,

      account_code: control.account_code,
      account_name: control.account_name || "Clientes",

      total,
      paid: 0,

      termsDays: DEFAULT_TERMS_DAYS,
      installments: DEFAULT_INSTALLMENTS,

      createdFrom: "ai_journal",
    });
  }
}

/* =============================================================================
   SAVE JOURNAL
============================================================================= */

export async function saveJournalEntries(
  entityId: string,
  entries: JournalEntry[],
  userId: string
): Promise<JournalEntry[]> {
  if (!entityId) throw new Error("saveJournalEntries: entityId is required");
  if (!userId) throw new Error("saveJournalEntries: userId (uid) is required");

  const col = collection(db, "entities", entityId, "journalEntries");

  const existing: Record<string, boolean> = {};
  const saved: JournalEntry[] = [];
  const batch = writeBatch(db);

  const validEntries = (entries ?? []).filter(
    (e) => n2(e.debit) > 0 || n2(e.credit) > 0
  );

  for (const e of validEntries) {
    // If caller didn't provide id, we still want deterministic write id for this entry.
    const autoRef = doc(col);
    const id = e.id ?? autoRef.id;

    // IMPORTANT:
    // If transactionId is not provided, defaulting it per-row causes "split transactions".
    // We keep your previous behavior, but we at least ensure it exists.
    const transactionId = e.transactionId ?? autoRef.id;

    const entry: JournalEntry = {
      ...e,
      id,
      entityId,
      uid: userId,
      transactionId,
      invoice_number: resolveInvoiceNumber({ ...e, transactionId }),
      description: resolveDescription(e),
      createdAt:
        typeof (e as any).createdAt === "number" ? (e as any).createdAt : Date.now(),
    };

    // 🔒 HARD VALIDATION (before Firestore)
    if (!entry.uid) throw new Error(`JournalEntry ${id} missing uid`);
    if (!entry.entityId) throw new Error(`JournalEntry ${id} missing entityId`);
    if (!entry.transactionId) throw new Error(`JournalEntry ${id} missing transactionId`);

    const key = duplicateKey(entry);
    if (existing[key]) continue;

    batch.set(doc(col, id), stripUndefined(entry) as any);
    saved.push(entry);
    existing[key] = true;
  }

  if (saved.length) {
    await batch.commit();

    // 🔁 Infer invoice type from control accounts
    const hasPayable = saved.some((e) => isSupplierPayableAccount(e.account_code));
    const hasReceivable = saved.some((e) => isCustomerReceivableAccount(e.account_code));

    if (hasPayable) await syncPayablesFromJournal(entityId, saved);
    if (hasReceivable) await syncReceivablesFromJournal(entityId, saved);
  }

  return saved;
}

/* =============================================================================
   PAYABLE PAYMENT (AP → BANK)
   NOTE: This function creates BOTH:
   - Journal entries for the payment
   - Bank movement + link
   Then applies payment to payable.
============================================================================= */

export async function createPayablePaymentJournalEntry(
  entityId: string,
  payable: Payable,
  amount: number,
  paymentDate: string,
  bankAccount: { id: string; account_code: string; name?: string },
  userId: string,
  options?: { bankMovementId?: string }
) {
  if (!entityId) throw new Error("entityId requerido");
  if (!userId) throw new Error("userId requerido");

  if (!payable.account_code) {
    throw new Error("Payable sin cuenta contable. Debe repararse.");
  }

  if (!Number.isFinite(amount) || amount <= 0 || amount > n2(payable.balance)) {
    throw new Error("Monto inválido");
  }

  if (!paymentDate) throw new Error("Fecha de pago requerida");

  if (!bankAccount?.id || !bankAccount?.account_code?.trim()) {
    throw new Error("Cuenta bancaria inválida (falta id o account_code)");
  }

  const tx =
    options?.bankMovementId ??
    doc(collection(db, "entities", entityId, "journalEntries")).id;

  const description = `Pago a proveedor ${payable.supplierName} — Factura ${payable.invoiceNumber}`;

  const entries: JournalEntry[] = [
    {
      entityId,
      transactionId: tx,
      date: paymentDate as any,
      account_code: payable.account_code,
      account_name: payable.account_name,
      debit: amount,
      credit: 0,
      invoice_number: payable.invoiceNumber,
      supplier_name: payable.supplierName as any,
      description,
      source: "manual" as any,
    },
    {
      entityId,
      transactionId: tx,
      date: paymentDate as any,
      account_code: bankAccount.account_code,
      account_name: bankAccount.name || "Banco",
      debit: 0,
      credit: amount,
      invoice_number: payable.invoiceNumber,
      supplier_name: payable.supplierName as any,
      description,
      source: "manual" as any,
    },
  ];

  await saveJournalEntries(entityId, entries, userId);

  const bankMovementId = await createBankMovement({
    entityId,
    bankAccountId: bankAccount.id,
    date: paymentDate,
    amount,
    type: "out",
    description,
    createdBy: userId as any,
  });

  await linkJournalTransaction(entityId, bankMovementId, tx);
  await applyPayablePayment(entityId, payable, amount);

  return tx;
}

/* =============================================================================
   RECEIVABLE COLLECTION (AR → BANK)
   NOTE:
   - Creates journal entry
   - Creates bank movement
   - Links both
   - Applies collection to receivable
============================================================================= */

import type { Receivable } from "@/types/Receivable";
import { applyReceivableCollection } from "./receivablesService";
import { Metadata } from "pdfjs-dist/types/src/display/metadata";

export async function createReceivableCollectionJournalEntry(
  entityId: string,
  receivable: Receivable,
  amount: number,
  collectionDate: string,
  bankAccount: { id: string; account_code: string; name?: string },
  userId: string,
  options?: { bankMovementId?: string }
) {
  if (!entityId) throw new Error("entityId requerido");
  if (!userId) throw new Error("userId requerido");

  if (!receivable.account_code) {
    throw new Error("Receivable sin cuenta contable. Debe repararse.");
  }

  if (!Number.isFinite(amount) || amount <= 0 || amount > n2(receivable.balance)) {
    throw new Error("Monto inválido");
  }

  if (!collectionDate) throw new Error("Fecha de cobro requerida");

  if (!bankAccount?.id || !bankAccount?.account_code?.trim()) {
    throw new Error("Cuenta bancaria inválida");
  }

  const tx =
    options?.bankMovementId ??
    doc(collection(db, "entities", entityId, "journalEntries")).id;

  const description = `Cobro a cliente ${receivable.customerName} — Factura ${receivable.invoiceNumber}`;

  const entries: JournalEntry[] = [
    {
      entityId,
      transactionId: tx,
      date: collectionDate as any,
      account_code: bankAccount.account_code,
      account_name: bankAccount.name || "Banco",
      debit: amount,
      credit: 0,
      invoice_number: receivable.invoiceNumber,
      customer_name: receivable.customerName as any,
      description,
      source: "manual" as any,
    },
    {
      entityId,
      transactionId: tx,
      date: collectionDate as any,
      account_code: receivable.account_code,
      account_name: receivable.account_name,
      debit: 0,
      credit: amount,
      invoice_number: receivable.invoiceNumber,
      customer_name: receivable.customerName as any,
      description,
      source: "manual" as any,
    },
  ];

  await saveJournalEntries(entityId, entries, userId);

  const bankMovementId = await createBankMovement({
    entityId,
    bankAccountId: bankAccount.id,
    date: collectionDate,
    amount,
    type: "in",
    description,
    createdBy: userId as any,
  });

  await linkJournalTransaction(entityId, bankMovementId, tx);
  await applyReceivableCollection(entityId, receivable, amount);

  return tx;
}

/* =============================================================================
   CASCADE DELETE — INVOICE ANNULMENT
   Deletes:
   - Journal entries
   - Receivable (AR)
   - Payable (AP)
   - Processed invoice log
============================================================================= */

export async function annulInvoiceByTransaction(
  entityId: string,
  transactionId: string,
  invoiceNumber?: string
) {
  if (!entityId || !transactionId) {
    throw new Error("annulInvoiceByTransaction: missing params");
  }

  const batch = writeBatch(db);

  // ------------------------------------------------------------------
  // 1️⃣ Journal entries
  // ------------------------------------------------------------------
  const journalCol = collection(db, "entities", entityId, "journalEntries");
  const qJournal = query(journalCol, where("transactionId", "==", transactionId));
  const journalSnap = await getDocs(qJournal);

  journalSnap.forEach(d => batch.delete(d.ref));

  // ------------------------------------------------------------------
  // 2️⃣ Receivables (AR)
  // ------------------------------------------------------------------
  const arCol = collection(db, "entities", entityId, "receivables");
  const arQuery = invoiceNumber
    ? query(arCol, where("invoiceNumber", "==", invoiceNumber))
    : query(arCol, where("transactionId", "==", transactionId));

  const arSnap = await getDocs(arQuery);

  // Before deleting AR
  if (arSnap.docs.some(d => Number(d.data().paid) > 0)) {
    throw new Error("No se puede anular una factura con cobros registrados");
  }

  arSnap.forEach(d => batch.delete(d.ref));

  // ------------------------------------------------------------------
  // 3️⃣ Payables (AP)
  // ------------------------------------------------------------------
  const apCol = collection(db, "entities", entityId, "payables");
  const apQuery = invoiceNumber
    ? query(apCol, where("invoiceNumber", "==", invoiceNumber))
    : query(apCol, where("transactionId", "==", transactionId));

  const apSnap = await getDocs(apQuery);

  // Before deleting AP
  if (apSnap.docs.some(d => Number(d.data().paid) > 0)) {
    throw new Error("No se puede anular una factura con pagos registrados");
  }

  apSnap.forEach(d => batch.delete(d.ref));

  // ------------------------------------------------------------------
  // 4️⃣ Processed invoice log
  // (adjust collection name if yours differs)
  // ------------------------------------------------------------------
  if (invoiceNumber) {
    const logCol = collection(db, "entities", entityId, "processedInvoices");
    const logQuery = query(logCol, where("invoiceNumber", "==", invoiceNumber));
    const logSnap = await getDocs(logQuery);
    logSnap.forEach(d => batch.delete(d.ref));
  }

  // ------------------------------------------------------------------
  // 5️⃣ Commit atomically
  // ------------------------------------------------------------------
  await batch.commit();
}