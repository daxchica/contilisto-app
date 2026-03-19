// ============================================================================
// src/services/journalService.ts
// CONTILISTO — Journal Service (Upgraded / AP+AR Sync Safe)
// FIXED:
// - AP sync only from true supplier invoice control accounts (20103...)
// - AR sync only from true customer invoice control accounts (10103...)
// - prevents sales invoices from entering payables
// - prevents expense invoices from entering receivables
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
  type QueryConstraint,
} from "firebase/firestore";

import type { JournalEntry } from "@/types/JournalEntry";
import type { Payable } from "@/types/Payable";
import type { Receivable } from "@/types/Receivable";
import type { AccountingDocument } from "@/types/AccountingDocument";

import { upsertPayable, applyPayablePayment } from "./payablesService";
import { upsertReceivable } from "./receivablesService";
import { applyReceivablePayment } from "./receivablesService";
import {
  createBankMovement,
  linkJournalTransaction,
} from "./bankMovementService";
import {
  isCustomerReceivableAccount,
  isSupplierPayableAccount,
} from "./controlAccounts";
import { requireEntityId } from "./requireEntityId";
import { requireNonEmpty } from "./requireNonEmpty";
import {
  saveAccountingDocument,
  linkJournalEntriesToDocument,
  fetchAccountingDocuments,
} from "@/services/documents/documentRegistryService";
import { findDuplicateDocument } from "./documents/documentDuplicateService";
import { updateAccountBalancesFromJournalEntries } from "./accountBalanceService";

/* =============================================================================
   HELPERS
============================================================================= */

const DEFAULT_TERMS_DAYS = 30;
const DEFAULT_INSTALLMENTS = 1;

// Ecuador "Consumidor Final" (SRI)
const CONSUMIDOR_FINAL_ID = "9999999999999";
const CONSUMIDOR_FINAL_NAME = "CONSUMIDOR FINAL";

const norm = (c?: string) => (c || "").replace(/\./g, "").trim();

const n2 = (x: any) =>
  Number.isFinite(Number(x)) ? Number(Number(x).toFixed(2)) : 0;

function isParentAccount(code: string) {
  const clean = norm(code);
  return clean.length <= 7;
}

/**
 * STRICT CONTROL RULES
 * These are the important fixes.
 *
 * AP invoice control must come from supplier invoice accounts only: 20103...
 * AR invoice control must come from customer invoice accounts only: 10103...
 *
 * This avoids confusing:
 * - 201020101 IVA débito en ventas
 * - 113020xxx retentions
 * with real AP/AR invoices.
 */
function isStrictPayableInvoiceControl(code?: string) {
  const c = norm(code);
  return c.startsWith("20103") && !isParentAccount(c);
}

function isStrictReceivableInvoiceControl(code?: string) {
  const c = norm(code);
  return c.startsWith("10103") && !isParentAccount(c);
}

function isRevenueLine(e: JournalEntry) {
  return norm(e.account_code).startsWith("4") && n2(e.credit) > 0;
}

function isExpenseLine(e: JournalEntry) {
  return norm(e.account_code).startsWith("5") && n2(e.debit) > 0;
}

function isPurchaseVATAssetLine(e: JournalEntry) {
  return norm(e.account_code).startsWith("133") && n2(e.debit) > 0;
}

function isSalesVATLiabilityLine(e: JournalEntry) {
  return norm(e.account_code).startsWith("20102") && n2(e.credit) > 0;
}

function groupHasExpenseSignals(group: JournalEntry[]) {
  return group.some((e) =>
    isStrictPayableInvoiceControl(e.account_code) ||
    isExpenseLine(e) ||
    isPurchaseVATAssetLine(e) ||
    !!String((e as any).supplier_name ?? (e as any).issuerName ?? "").trim()
  );
}

function groupHasSaleSignals(group: JournalEntry[]) {
  return group.some((e) =>
    isStrictReceivableInvoiceControl(e.account_code) ||
    isRevenueLine(e) ||
    isSalesVATLiabilityLine(e) ||
    !!String((e as any).customer_name ?? (e as any).buyerName ?? "").trim()
  );
}

async function fetchInitialBalanceDate(
  entityId: string
): Promise<string | null> {
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

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);

    let day = a;
    let month = b;

    if (a <= 12 && b > 12) {
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

    if (entryISO < initialISO) {
      throw new Error(
        `No se puede registrar asientos con fecha ${entryISO} antes del Balance Inicial (${initialISO}).`
      );
    }
  }
}

/**
 * Removes undefined recursively without destroying Firestore special values.
 */
function stripUndefined<T>(value: T): T {
  if (value && typeof value === "object") {
    const anyV = value as any;
    const ctor = anyV?.constructor?.name;
    if (ctor === "Timestamp" || ctor === "FieldValue") return value;
    if (typeof anyV?.toDate === "function") return value;
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

function validateControlAccounts(entries: JournalEntry[]) {
  const arAccounts = entries.filter((e) =>
    isStrictReceivableInvoiceControl(e.account_code)
  );
  const apAccounts = entries.filter((e) =>
    isStrictPayableInvoiceControl(e.account_code)
  );

  const uniqueAR = [...new Set(arAccounts.map((e) => norm(e.account_code)))];
  const uniqueAP = [...new Set(apAccounts.map((e) => norm(e.account_code)))];

  if (uniqueAR.length > 1) {
    throw new Error(
      `La transacción contiene múltiples cuentas de clientes (${uniqueAR.join(", ")})`
    );
  }

  if (uniqueAP.length > 1) {
    throw new Error(
      `La transacción contiene múltiples cuentas de proveedores (${uniqueAP.join(", ")})`
    );
  }
}

function duplicateKey(e: JournalEntry) {
  const d = (e as any).date ?? "";
  return `${e.entityId}::${e.transactionId}::${e.invoice_number}::${e.account_code}::${e.debit}::${e.credit}::${d}`;
}

function resolveDescription(e: JournalEntry): string {
  if (e.source === "initial") return "Balance inicial";

  const invoice = e.invoice_number?.trim();
  const supplier = (e as any).supplier_name?.trim();
  const customer = (e as any).customer_name?.trim();

  if (invoice) {
    const party = supplier || customer || "";
    return party ? `Factura ${invoice} — ${party}` : `Factura ${invoice}`;
  }

  if (e.description?.trim()) return e.description.trim();

  return "Asiento contable";
}

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
    const q = query(col, orderBy("date", "asc"));
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
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

export async function fetchJournalEntriesByDateRange(
  entityId: string,
  fromDate?: string,
  toDate?: string
): Promise<JournalEntry[]> {
  requireEntityId(entityId, "cargar diario");

  const col = collection(db, "entities", entityId, "journalEntries");
  const constraints: QueryConstraint[] = [];

  if (fromDate) constraints.push(where("date", ">=", fromDate));
  if (toDate) constraints.push(where("date", "<=", toDate));

  constraints.push(orderBy("date", "asc"));

  const q = query(col, ...constraints);
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as JournalEntry),
  }));
}

/* =============================================================================
   INTERNAL SYNC (Journal → AP / AR)
============================================================================= */

async function syncPayablesFromJournal(entityId: string, saved: JournalEntry[]) {
  const grouped = new Map<string, JournalEntry[]>();

  for (const e of saved) {
    if (!e.transactionId) continue;
    if (!grouped.has(e.transactionId)) grouped.set(e.transactionId, []);
    grouped.get(e.transactionId)!.push(e);
  }

  for (const [tx, group] of grouped) {
    if (group.some((e) => e.source === "initial")) continue;

    // IMPORTANT:
    // Never let a clear sales transaction become AP.
    if (groupHasSaleSignals(group) && !groupHasExpenseSignals(group)) {
      continue;
    }

    const control = group.find(
      (e) =>
        isStrictPayableInvoiceControl(e.account_code) &&
        n2(e.credit) > 0 &&
        !isParentAccount(norm(e.account_code))
    );

    if (!control) continue;

    const invoiceNumber = control.invoice_number?.trim();
    if (!invoiceNumber) continue;

    const supplierName = String(
      (control as any)?.supplier_name ??
        (control as any)?.issuerName ??
        ""
    ).trim();

    if (!supplierName) continue;

    const total = n2(control.credit);
    if (total <= 0) continue;

    await upsertPayable(entityId, {
      transactionId: tx,
      invoiceNumber,
      issueDate: control.date || new Date().toISOString().slice(0, 10),

      supplierName,
      supplierRUC: String(
        (control as any).supplier_ruc ??
          (control as any).supplierRUC ??
          (control as any).issuerRUC ??
          ""
      ).trim(),

      account_code: norm(control.account_code),
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
  const grouped = new Map<string, JournalEntry[]>();

  for (const e of saved) {
    if (!e.transactionId) continue;
    if (!grouped.has(e.transactionId)) grouped.set(e.transactionId, []);
    grouped.get(e.transactionId)!.push(e);
  }

  for (const [tx, group] of grouped) {
    if (group.some((e) => e.source === "initial")) continue;

    // IMPORTANT:
    // Never let a clear expense transaction become AR.
    if (groupHasExpenseSignals(group) && !groupHasSaleSignals(group)) {
      continue;
    }

    const control = group.find(
      (e) =>
        isStrictReceivableInvoiceControl(e.account_code) &&
        n2(e.debit) > 0 &&
        !isParentAccount(norm(e.account_code))
    );

    if (!control) continue;

    const total = n2(control.debit);
    if (total <= 0) continue;

    const invoiceNumber = control.invoice_number?.trim();
    if (!invoiceNumber) {
      console.warn(`[AR SYNC] tx=${tx} missing invoice_number`);
      continue;
    }

    const customerName = getCustomerName(control) || CONSUMIDOR_FINAL_NAME;
    const customerRUC = getCustomerRUC(control) || CONSUMIDOR_FINAL_ID;

    await upsertReceivable(entityId, {
      transactionId: tx,
      invoiceNumber,
      issueDate: control.date || new Date().toISOString().slice(0, 10),

      customerName,
      customerRUC,

      account_code: norm(control.account_code),
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

  const transactionIds = new Set(entries.map((e) => e.transactionId));
  if (transactionIds.size !== 1) {
    throw new Error("All journal lines must share the same transactionId.");
  }
}

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
  document?: AccountingDocument
): Promise<JournalEntry[]> {
  requireEntityId(entityId, "guardar diario");

  if (!userIdSafe?.trim()) {
    throw new Error("saveJournalEntries: userIdSafe (uid) is required");
  }

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
  validateControlAccounts(validEntries);

  for (const e of validEntries) {
    const code = norm(e.account_code);

    if (isCustomerReceivableAccount(code) && isParentAccount(code)) {
      throw new Error(
        `Cuenta de clientes invalida (${code}). Use una subcuenta.`
      );
    }

    if (isSupplierPayableAccount(code) && isParentAccount(code)) {
      throw new Error(
        `Cuenta de proveedores invalida (${code}). Use una subcuenta.`
      );
    }
  }

  const txIds = new Set(entries.map((e) => e.transactionId));
  if (txIds.size !== 1) {
    throw new Error(
      "Asientos de múltiples transacciones en un mismo guardado no permitido"
    );
  }

  for (const e of validEntries) {
    const autoRef = doc(col);
    const id = e.id ?? autoRef.id;

    if (!e.transactionId) {
      throw new Error("saveJournalEntries: transactionId is required");
    }
    const transactionId = e.transactionId;

    const normalizedDate = toISODateOrNull(String(e.date ?? ""));
    if (!normalizedDate) {
      throw new Error(`Fecha inválida: ${e.date}`);
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

      account_code: norm(e.account_code),
      account_name: String(e.account_name ?? "").trim(),

      invoice_number:
        e.invoice_number ??
        (e.source === "manual" ? `MANUAL-${transactionId}` : undefined),

      date: normalizedDate,
      description: resolveDescription(e),
      source: e.source ?? "vision",

      createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    if (!entry.uid) throw new Error(`JournalEntry ${id} missing uid`);
    if (!entry.entityId) throw new Error(`JournalEntry ${id} missing entityId`);
    if (!entry.transactionId) {
      throw new Error(`JournalEntry ${id} missing transactionId`);
    }

    requireNonEmpty(entry.account_code, "account code");

    if (entry.source === "initial" && !entry.date) {
      throw new Error("Initial Balance entries must have a fixed date");
    }

    const key = duplicateKey(entry);
    if (existing[key]) continue;

    const cleanEntry = stripUndefined(entry);
    batch.set(doc(col, id), cleanEntry as any);

    saved.push(entry);
    existing[key] = true;
  }

  const debit = saved.reduce((s, e) => s + (e.debit ?? 0), 0);
  const credit = saved.reduce((s, e) => s + (e.credit ?? 0), 0);

  if (Math.abs(debit - credit) > 0.001) {
    throw new Error("Transacción no balanceada");
  }

  const initialDate = await fetchInitialBalanceDate(entityId);
  if (initialDate) {
    assertNotBeforeInitialBalanceDate(saved, initialDate);
  }

  if (saved.length) {
    if (document) {
      await saveAccountingDocument(document);
    }

    await batch.commit();

    try {
      await updateAccountBalancesFromJournalEntries(entityId, saved);
    } catch (err) {
      console.error("Account balance update failed:", err);
    }

    if (document) {
      const ids = saved.map((e) => e.id!).filter(Boolean);
      await linkJournalEntriesToDocument(entityId, document.id, ids);
    }

    const hasPayable = saved.some(
      (e: JournalEntry) =>
        isStrictPayableInvoiceControl(e.account_code) && 
        n2(e.credit) > 0
    );

    const hasReceivable = saved.some(
      (e: JournalEntry) =>
        isStrictReceivableInvoiceControl(e.account_code) && 
        n2(e.debit) > 0
    );

    const isInitialBalance = saved.some((e) => e.source === "initial");

    if (!isInitialBalance) {
      if (hasPayable) {
        await syncPayablesFromJournal(entityId, saved);
      }

      if (hasReceivable) {
        try {
          await syncReceivablesFromJournal(entityId, saved);
        } catch (e) {
          console.error("AR SYNC FAILED", e);
        }
      }
    }
  }

  return saved;
}

/* =============================================================================
   PAYABLE PAYMENT (AP → BANK)
============================================================================= */

export async function createPayablePaymentJournalEntry(
  entityId: string,
  payable: Payable,
  amountPaid: number,
  paymentDate: string,
  bankAccount: { id: string; account_code: string; name?: string },
  userIdSafe: string,
  options?: {
    bankMovementId?: string;
    retentionIR?: number;
    retentionIVA?: number;
  }
) {
  requireEntityId(entityId, "registrar pago");

  const retentionIR = options?.retentionIR ?? 0;
  const retentionIVA = options?.retentionIVA ?? 0;
  const amount = n2(amountPaid);
  const payableBalance = n2(payable.balance);

  const payableAccountCode = norm(payable.account_code);
  const bankAccountCode = norm(bankAccount.account_code);

  if (!payableAccountCode) {
    throw new Error("La cuenta bancaria seleccionada no tiene cuenta contable configurada.");
  }

  if (!bankAccountCode) {
    throw new Error("La cuenta bancaria seleccionada no tiene cuenta contable configurada.");
  }

  if (!payable.account_name?.trim()) {
    throw new Error("La cuenta bancaria seleccionada no tiene cuenta contable configurada.");
  }

  if (!paymentDate?.trim()) {
    throw new Error("Fecha requerida");
  }

  const totalApplied = n2(amount + retentionIR + retentionIVA);

  if (totalApplied <= 0) {
    throw new Error("El pago aplicado debe ser mayor a cero");
  }

  if (totalApplied > payableBalance) {
    throw new Error("El pago aplicado excede el saldo de la factura");
  }

  const tx =
    options?.bankMovementId ??
    doc(collection(db, "entities", entityId, "journalEntries")).id;

  const description = `Pago proveedor ${payable.supplierName} — Factura ${payable.invoiceNumber}`;

  const entries: JournalEntry[] = [
    {
      entityId,
      transactionId: tx,
      date: paymentDate,
      account_code: norm(payable.account_code),
      account_name: payable.account_name,
      debit: totalApplied,
      credit: 0,
      invoice_number: payable.invoiceNumber,
      supplier_name: payable.supplierName as any,
      description,
      source: "manual",
    },
    {
      entityId,
      transactionId: tx,
      date: paymentDate,
      account_code: bankAccount.account_code,
      account_name: bankAccount.name ?? "Banco",
      debit: 0,
      credit: amountPaid,
      invoice_number: payable.invoiceNumber,
      supplier_name: payable.supplierName as any,
      description,
      source: "manual",
    },
  ];

  if (retentionIR > 0) {
    entries.push({
      entityId,
      transactionId: tx,
      date: paymentDate,
      account_code: "2360101",
      account_name: "Retenciones Impuesto a la Renta",
      debit: 0,
      credit: retentionIR,
      invoice_number: payable.invoiceNumber,
      supplier_name: payable.supplierName as any,
      description: `Retención IR — Factura ${payable.invoiceNumber}`,
      source: "manual",
    });
  }

  if (retentionIVA > 0) {
    entries.push({
      entityId,
      transactionId: tx,
      date: paymentDate,
      account_code: "2330101",
      account_name: "Retenciones IVA",
      debit: 0,
      credit: retentionIVA,
      invoice_number: payable.invoiceNumber,
      supplier_name: payable.supplierName as any,
      description: `Retención IVA — Factura ${payable.invoiceNumber}`,
      source: "manual",
    });
  }

  console.log("PAYABLE ACCOUNT", payable.account_code);

  await saveJournalEntries(entityId, userIdSafe, entries);

  const bankMovementId = await createBankMovement({
    entityId,
    bankAccountId: bankAccount.id,
    date: paymentDate,
    amount: amountPaid,
    type: "out",
    description,
    createdBy: userIdSafe,
  });

  await linkJournalTransaction(entityId, bankMovementId, tx);
  await applyPayablePayment(entityId, payable, totalApplied);

  return tx;
}

/* =============================================================================
   RECEIVABLE COLLECTION (AR → BANK)
============================================================================= */

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

  if (
    !isCustomerReceivableAccount(norm(receivable.account_code)) ||
    isParentAccount(norm(receivable.account_code))
  ) {
    throw new Error(
      `Cuenta de cliente invalida: ${receivable.account_code}`
    );
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
      date: toISODateOrNull(collectionDate) ?? collectionDate,
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
      date: toISODateOrNull(collectionDate) ?? collectionDate,
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

  const bankMovementId =
    options?.bankMovementId ??
    doc(collection(db, "entities", entityId, "bankMovements")).id;

  await linkJournalTransaction(entityId, bankMovementId, tx);
  await applyReceivablePayment(entityId, receivable, amount, userIdSafe, tx);

  return tx;
}

/* =============================================================================
   CASCADE DELETE — INVOICE ANNULMENT
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

  const journalCol = collection(db, "entities", entityId, "journalEntries");
  const qJournal = query(journalCol, where("transactionId", "==", transactionId));
  const journalSnap = await getDocs(qJournal);
  journalSnap.forEach((d) => batch.delete(d.ref));

  const arCol = collection(db, "entities", entityId, "receivables");
  const arQuery = invoiceNumber
    ? query(arCol, where("invoiceNumber", "==", invoiceNumber))
    : query(arCol, where("transactionId", "==", transactionId));

  const arSnap = await getDocs(arQuery);
  if (arSnap.docs.some((d) => Number(d.data().paid ?? 0) > 0)) {
    throw new Error("No se puede anular una factura con cobros registrados");
  }
  arSnap.forEach((d) => batch.delete(d.ref));

  const apCol = collection(db, "entities", entityId, "payables");
  const apQuery = invoiceNumber
    ? query(apCol, where("invoiceNumber", "==", invoiceNumber))
    : query(apCol, where("transactionId", "==", transactionId));

  const apSnap = await getDocs(apQuery);
  if (apSnap.docs.some((d) => Number(d.data().paid ?? 0) > 0)) {
    throw new Error("No se puede anular una factura con pagos registrados");
  }
  apSnap.forEach((d) => batch.delete(d.ref));

  if (invoiceNumber) {
    const logCol = collection(db, "entities", entityId, "processedInvoices");
    const logQuery = query(logCol, where("invoiceNumber", "==", invoiceNumber));
    const logSnap = await getDocs(logQuery);
    logSnap.forEach((d) => batch.delete(d.ref));
  }

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

  if (norm(fromAccountCode) === norm(toAccountCode)) {
    throw new Error("Transferencia inválida: misma cuenta origen y destino");
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