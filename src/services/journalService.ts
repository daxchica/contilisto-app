// ============================================================================
// src/services/journalService.ts
// CONTILISTO — Journal Service (Upgraded / AP+AR Sync Safe)
// ============================================================================

import { db } from "@/firebase-config";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  where,
  writeBatch,
  limit,
  serverTimestamp,
  type QueryConstraint,
} from "firebase/firestore";

import type { JournalEntry } from "@/types/JournalEntry";
import type { Payable } from "@/types/Payable";

import { upsertPayable, applyPayablePayment } from "./payablesService";
import { upsertReceivable } from "./receivablesService";
import {
  createBankMovement,
  linkJournalTransaction,
} from "./bankMovementService";
import { isCustomerReceivableAccount, isSupplierPayableAccount } from "./controlAccounts";
import { requireEntityId } from "./requireEntityId";
import { requireNonEmpty } from "./requireNonEmpty";
import {
  saveAccountingDocument,
  linkJournalEntriesToDocument,
  fetchAccountingDocuments,
} from "@/services/documents/documentRegistryService";

import { findDuplicateDocument } from "./documents/documentDuplicateService";

import type { AccountingDocument } from "@/types/AccountingDocument";


/* =============================================================================
   HELPERS
============================================================================= */

async function fetchInitialBalanceDate(entityId: string): Promise<string | null> {
  requireEntityId(entityId, "cargar balance inicial");

  const q = query(
    collection(db, "entities", entityId, "journalEntries"),
    where("source", "==", "initial"),
    orderBy("date", "asc"),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const first = snap.docs[0].data();
  return typeof first.date === "string" ? first.date.slice(0, 10) : null;
  
}

function toISODateOrNull(raw: string): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;

  // If it's already ISO or ISO datetime
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // DD/MM/YYYY (or MM/DD/YYYY)
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);

    // Ecuador default: DD/MM/YYYY
    let day = a;
    let month = b;

    // If clearly MM/DD/YYYY (e.g., 13/02 impossible as month)
    if (a <= 12 && b > 12) {
      // swap
      day = b;
      month = a;
    }

    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  return null;
}

function assertNotBeforeInitialBalanceDate(
  entries: JournalEntry[],
  initialDateRaw: string
) {
  const initialISO = toISODateOrNull(initialDateRaw);

  if (!initialISO) {
    throw new Error(`Balance Inicial con fecha inválida: "${initialDateRaw}"`);
  }

  for (const e of entries) {
    if (e.source === "initial") continue;

    const entryISO = toISODateOrNull(String(e.date ?? ""));

    if (!entryISO) {
      throw new Error(
        `Entrada sin fecha válida (date="${String(e.date ?? "")}") no se puede guardar.`
      );
    }

    // Safe lexicographic compare (both ISO)
    if (entryISO < initialISO) {
      throw new Error(
        `No se puede registrar asientos con fecha ${entryISO} antes del Balance Inicial (${initialISO}).`
      );
    }
  }
}

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

function duplicateKey(e: JournalEntry) {
  // Include date to reduce accidental collisions when invoice number repeats.
  const d = (e as any).date ?? "";
  return `${e.entityId}::${e.transactionId}::${e.invoice_number}::${e.account_code}::${e.debit}::${e.credit}::${d}`;
}

/** 
function resolveInvoiceNumber(e: JournalEntry) {
  if (e.invoice_number?.trim()) return e.invoice_number.trim();
  if (!e.transactionId) {
    throw new Error("Asiento manual sin invoice_number requiere transactionId");
  }
  return `MANUAL-${e.transactionId}`;
} */

function resolveDescription(e: JournalEntry): string {
  if (e.source === "initial") return "Balance inicial";

  const invoice = e.invoice_number?.trim();
  const supplier = (e as any).supplier_name?.trim();
  const customer = (e as any).customer_name?.trim();

  if (invoice) {
    const party = supplier || customer || "";
    return party
      ? `Factura ${invoice} — ${party}`
      : `Factura ${invoice}`;
  }

  if (e.description?.trim()) return e.description.trim();
  
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

export async function fetchJournalEntries(
  entityId: string
): Promise<JournalEntry[]> {
  requireEntityId(entityId, "cargar diario");

  const col = collection(db, "entities", entityId, "journalEntries");

  try {
    // ✅ SINGLE orderBy → NO composite index required
    const q = query(col, orderBy("date", "asc"));
    const snap = await getDocs(q);

    return snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as JournalEntry),
    }));
  } catch (err) {
    console.error("fetchJournalEntries failed:", err);
    return [];
  }
}

export async function fetchJournalEntriesByTransactionId(
  entityId: string,
  transactionId: string
): Promise<JournalEntry[]> {
  requireEntityId(entityId, "cargar transacción de diario");
  if (!transactionId) return [];

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
    if (group.some((e: JournalEntry) => e.source === "initial")) continue;
    
    const control = group.find((e) => isSupplierPayableAccount(e.account_code));
    
    if (!control) continue;

    const total = n2(control.credit);
    if (total <= 0) continue;

    if (!control.invoice_number?.trim()) {
      console.warn(`[AP SYNC] tx=${tx} missing invoice_number`);
      continue;
    }

    const supplierName =
      String(
        (control as any).supplier_name ??
        (control as any).issuerName ??
        control.description?.split("-")[1]?.trim() ??
        control.description ??
        ""
      ).trim() || "PROVEEDOR";

    const supplierRUC =
      String(
        (control as any).supplier_ruc ??
        (control as any).supplierRUC ??
        (control as any).issuerRUC ??
        ""
      ).trim();

    await upsertPayable(entityId, {
      transactionId: tx,

      invoiceNumber: control.invoice_number.trim(),
      
      issueDate: control.date || new Date().toISOString().slice(0,10),

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

    if (group.some((e: JournalEntry) => e.source === "initial")) {
      continue;
    }

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

function validateBalancedTransaction(entries: JournalEntry[]) {
  const totalDebit = entries.reduce((sum, e) => sum + Number(e.debit || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + Number(e.credit || 0), 0);

  if (Number(totalDebit.toFixed(2)) !== Number(totalCredit.toFixed(2))) {
    throw new Error(
      `Unbalanced transaction. Debit=${totalDebit} Credit=${totalCredit}`
    );
  }
}

function validateTransactionIntegrity(entries: JournalEntry[]) {
  if (entries.length < 2) {
    throw new Error("Transaction must contain at least 2 journal lines.");
  }

  const transactionIds = new Set(entries.map(e => e.transactionId));
  if (transactionIds.size !== 1) {
    throw new Error("All journal lines must share the same transactionId.");
  }
}

// ============================================================================
// DOCUMENT DUPLICATE VALIDATION
// Prevents registering the same invoice twice
// ============================================================================

async function assertNoDuplicateDocument(
  entityId: string,
  document?: AccountingDocument
) {
  if (!document) return;

  const existingDocs = await fetchAccountingDocuments(entityId);

  const duplicate = findDuplicateDocument(existingDocs, document);

  if (duplicate) {
    throw new Error(
      `Factura duplicada detectada.\n` +
      `Proveedor/RUC: ${document.counterpartyRUC}\n` +
      `Número: ${document.documentNumber}`
    );
  }
}

export async function saveJournalEntries(
  entityId: string,
  userIdSafe: string,
  entries: JournalEntry[],
  document?: AccountingDocument,
): Promise<JournalEntry[]> {
  requireEntityId(entityId, "guardar diario");
  if (!userIdSafe?.trim()) throw new Error("saveJournalEntries: userIdSafe (uid) is required");
  
  // ----------------------------------------------------------------------
  // DUPLICATE DOCUMENT PROTECTION
  // ----------------------------------------------------------------------

  await assertNoDuplicateDocument(entityId, document);

  const col = collection(db, "entities", entityId, "journalEntries");

  const existing: Record<string, boolean> = {};
  const saved: JournalEntry[] = [];
  const batch = writeBatch(db);

  const validEntries = (entries ?? []).filter(
    (e) => n2(e.debit) > 0 || n2(e.credit) > 0
  );

  validateTransactionIntegrity(validEntries);
  validateBalancedTransaction(validEntries);

  const txIds = new Set(entries.map((e: JournalEntry) => e.transactionId));
  if (txIds.size !== 1) {
    throw new Error("Asientos de múltiples transacciones en un mismo guardado no permitido");
  }
  
  if (validEntries.length > 0) {
      const first = validEntries[0];

      const issuerRUC = 
        (first as any).issuerRUC ??
        (first as any).supplier_ruc ??
        (first as any).customer_ruc ??
        "";
      
        const invoiceNumber = first.invoice_number ?? "";

    }

  for (const e of validEntries) {
    // If caller didn't provide id, we still want deterministic write id for this entry.
    const autoRef = doc(col);
    const id = e.id ?? autoRef.id;

    // IMPORTANT:
    // If transactionId is not provided, defaulting it per-row causes "split transactions".
    // We keep your previous behavior, but we at least ensure it exists.
    if (!e.transactionId) {
      throw new Error("saveJournalEntries: transactionId is required");
    }
    const transactionId = e.transactionId;

    // ----------------------------------------------------------------------
    // 🔒 DUPLICATE INVOICE PROTECTION (RUN ONCE)
    // ----------------------------------------------------------------------

    if (!e.date) {
        throw new Error("JournalEntry sin fecha contable (date)");
      }

    const entry: JournalEntry = {
      ...e,
      id,
      entityId,
      uid: userIdSafe,
      transactionId,

      documentId: document?.id,

      debit: n2(e.debit),
      credit: n2(e.credit),

      account_code: String(e.account_code ?? "").trim(),
      account_name: String(e.account_name ?? "").trim(),

      invoice_number: e.invoice_number ?? `MANUAL-${transactionId}`,

      date: e.date,
      
      description: resolveDescription(e),

      source: e.source ?? "vision",

      createdAt: typeof e.createdAt === "number"
        ? e.createdAt
        : Date.now(), 

      updatedAt: Date.now(),
    };

    // 🔒 HARD VALIDATION (before Firestore)
    if (!entry.uid) throw new Error(`JournalEntry ${id} missing uid`);
    if (!entry.entityId) throw new Error(`JournalEntry ${id} missing entityId`);
    if (!entry.transactionId) throw new Error(`JournalEntry ${id} missing transactionId`);
    requireNonEmpty(entry.account_code, "account code");
    if (entry.source === "initial" && !entry.date) {
      throw new Error("Initial Balance entries must have a fixed date");
    }

    const key = duplicateKey(entry);
    if (existing[key]) continue;

    console.log("ENTRY BEING WRITTEN:", entry);

    const cleanEntry = stripUndefined(entry);

    console.log("🔥 FIRESTORE WRITE ATTEMPT:", {
      authUid: userIdSafe,
      entryUid: cleanEntry.uid,
      entityId,
      entryEntityId: cleanEntry.entityId,
      transactionId: cleanEntry.transactionId,
      invoice_number: cleanEntry.invoice_number,
      debit: cleanEntry.debit,
      credit: cleanEntry.credit,
    });

    batch.set(doc(col, id), cleanEntry as any);
    saved.push(entry);
    existing[key] = true;
  }

  // 🔒 HARD ACCOUNTING RULE — BEFORE WRITE
  const initialDate = await fetchInitialBalanceDate(entityId);
    if (initialDate) {
      assertNotBeforeInitialBalanceDate(saved, initialDate);
    }

  const totalDebit = saved.reduce(
    (s: number, e: JournalEntry) => s + (e.debit ?? 0),0);
  const totalCredit = saved.reduce(
    (s: number, e: JournalEntry) => s + (e.credit ?? 0),0);

  // ✅ SAFE TO COMMIT
  if (saved.length) {

    // -------------------------------------------------------
    // 1️⃣ Save Accounting Document (if provided)
    // -------------------------------------------------------

    if (document) {
      await saveAccountingDocument(document);
    }

    // -------------------------------------------------------
    // 2️⃣ Commit Journal Entries
    // -------------------------------------------------------

    await batch.commit();

      // -------------------------------------------------------
      // 3️⃣ Link document ↔ journal entries
      // -------------------------------------------------------

      if (document) {
        const ids = saved.map((e) => e.id!).filter(Boolean);

        await linkJournalEntriesToDocument(
          entityId,
          document.id,
          ids
        );
      }

    const hasPayable = saved.some(
      (e: JournalEntry) => isSupplierPayableAccount(e.account_code));
    const hasReceivable = saved.some(
      (e: JournalEntry) => isCustomerReceivableAccount(e.account_code));
    const isInitialBalance = saved.some((e: JournalEntry) => e.source === "initial");

    if (!isInitialBalance) {
      if (hasPayable) await syncPayablesFromJournal(entityId, saved);
      if (hasReceivable) await syncReceivablesFromJournal(entityId, saved);
    }
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
  userIdSafe: string,
  options?: { bankMovementId?: string }
) {
  requireEntityId(entityId, "registrar pago");
  if (!userIdSafe?.trim()) throw new Error("userIdSafe requerido");

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

  await saveJournalEntries(entityId, userIdSafe, entries);

  const bankMovementId = await createBankMovement({
    entityId,
    bankAccountId: bankAccount.id,
    date: paymentDate,
    amount,
    type: "out",
    description,
    createdBy: userIdSafe as any,
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

export async function createReceivableCollectionJournalEntry(
  entityId: string,
  receivable: Receivable,
  amount: number,
  collectionDate: string,
  bankAccount: { id: string; account_code: string; name?: string },
  userIdSafe: string,
  options?: { bankMovementId?: string }
) {
  requireEntityId(entityId, "registrar cobro");
  if (!userIdSafe?.trim()) throw new Error("userIdSafe requerido");

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

  await saveJournalEntries(entityId, userIdSafe, entries);

  const bankMovementId = await createBankMovement({
    entityId,
    bankAccountId: bankAccount.id,
    date: collectionDate,
    amount,
    type: "in",
    description,
    createdBy: userIdSafe as any,
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
  requireEntityId(entityId, "anular factura");
  if (!transactionId?.trim()) {
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
  if (arSnap.docs.some(d => Number(d.data().paid ?? 0) > 0)) {
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
  if (apSnap.docs.some(d => Number(d.data().paid ?? 0) > 0)) {
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

export async function createTransferJournalEntry(
  entityId: string,
  fromAccountCode: string,
  toAccountCode: string,
  amount: number,
  date: string,
  userId: string,
  fromAccountName?: string,
  toAccountName?: string
): Promise<string> {
  requireEntityId(entityId, "transferencia");
  if (!userId?.trim()) {
    throw new Error("userId requerido para transferencia");
  }
  const tx = doc(collection(db, "entities", entityId, "journalEntries")).id;
  const description = "Transferencia entre bancos";

  const entries: JournalEntry[] = [
    {
      entityId,
      transactionId: tx,
      date,
      account_code: toAccountCode,
      account_name: toAccountName ?? toAccountCode,
      debit: amount,
      credit: 0,
      description,
      source: "manual",
    },
    {
      entityId,
      transactionId: tx,
      date,
      account_code: fromAccountCode,
      account_name: fromAccountName ?? fromAccountCode,
      debit: 0,
      credit: amount,
      description,
      source: "manual",
    },
  ];

  await saveJournalEntries(entityId, userId, entries);
  return tx;
}
