// ============================================================================
// src/services/journalService.ts
// CONTILISTO — FINAL PRODUCTION VERSION (AP + AR SAFE + PAYMENT SAFE)
// IMPROVED VERSION (ACCOUNTING + SAFETY HARDENED)
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
} from "firebase/firestore";

import type { JournalEntry } from "@/types/JournalEntry";
import type { Payable } from "@/types/Payable";
import type { AccountingDocument } from "@/types/AccountingDocument";

import { upsertPayable, applyPayablePayment } from "./payablesService";

import {
  createBankMovement,
} from "./bankMovementService";

import { requireEntityId } from "./requireEntityId";
import { requireNonEmpty } from "./requireNonEmpty";

import { updateAccountBalancesFromJournalEntries } from "./accountBalanceService";

/* =============================================================================
   HELPERS
============================================================================= */

const DEFAULT_TERMS_DAYS = 30;
const DEFAULT_INSTALLMENTS = 1;

const norm = (c?: string) => (c || "").replace(/\./g, "").trim();

const n2 = (x: any) =>
  Number.isFinite(Number(x)) ? Number(Number(x).toFixed(2)) : 0;

function isParentAccount(code: string) {
  return norm(code).length <= 7;
}

function isStrictPayableInvoiceControl(code?: string) {
  const c = norm(code);
  return c.startsWith("20103") && !isParentAccount(c);
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

function groupHasExpenseSignals(group: JournalEntry[]) {
  return group.some((e) =>
    isStrictPayableInvoiceControl(e.account_code) ||
    isExpenseLine(e) ||
    isPurchaseVATAssetLine(e) ||
    !!String((e as any).supplier_name ?? "").trim()
  );
}

function normalizeInvoiceNumber(n?: string) {
  return String(n ?? "").replace(/\s+/g, "").replace(/-/g, "").trim();
}

// ============================================================================
// DELETE JOURNAL ENTRIES BY TRANSACTION ID (UI + DEV + RESET SUPPORT)
// ============================================================================

export async function deleteJournalEntriesByTransactionId(
  entityId: string,
  transactionId: string
): Promise<void> {

  requireEntityId(entityId, "eliminar journal");

  if (!transactionId?.trim()) {
    throw new Error("transactionId requerido");
  }

  const col = collection(db, "entities", entityId, "journalEntries");

  const q = query(
    col,
    where("transactionId", "==", transactionId),
    limit(500)
  );

  const snap = await getDocs(q);

  if (snap.empty) return;

  const batch = writeBatch(db);

  snap.docs.forEach((d) => {
    batch.delete(d.ref);
  });

  await batch.commit();

  // 🔥 IMPORTANT: keep balances consistent
  try {
    await updateAccountBalancesFromJournalEntries(entityId, []);
  } catch (err) {
    console.error("⚠️ Balance recalculation failed after delete", err);
  }
}

/* =============================================================================
   PAYABLE SYNC
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

    const isNonInvoice = group.some(
      (e) => e.transactionType === "payment" || e.transactionType === "transfer"
    );
    if (isNonInvoice) continue;

    if (!groupHasExpenseSignals(group)) continue;

    const control = group.find(
      (e) =>
        isStrictPayableInvoiceControl(e.account_code) &&
        n2(e.credit) > 0
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

    const supplierRUC = String(
      (control as any)?.supplier_ruc ??
      (control as any)?.issuerRUC ??
      ""
    ).replace(/\D/g, "");

    if (supplierRUC.length !== 13) continue;

    const total =
      n2((control as any).total) ||
      n2(control.credit);

    if (total <= 0) continue;

    await upsertPayable(entityId, {
      transactionId: tx,
      invoiceNumber,
      invoiceNumberNormalized: normalizeInvoiceNumber(invoiceNumber),
      issueDate: control.date,

      supplierName,
      supplierRUC,

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

/* =============================================================================
   SAVE JOURNAL
============================================================================= */

export async function saveJournalEntries(
  entityId: string,
  userIdSafe: string,
  entries: JournalEntry[],
  document?: AccountingDocument
): Promise<JournalEntry[]> {

  requireEntityId(entityId, "guardar diario");

  if (!userIdSafe?.trim()) throw new Error("UID requerido");
  if (!entries?.length) throw new Error("No entries provided");

  const txIds = new Set(entries.map(e => e.transactionId).filter(Boolean));
  if (txIds.size !== 1) throw new Error("Todas las líneas deben tener el mismo transactionId");

  const txId = entries[0]?.transactionId;
  if (!txId || !txId.trim()) throw new Error("transactionId requerido");

  const existingTx = await fetchJournalEntriesByTransactionId(entityId, txId);
  if (existingTx.length > 0) throw new Error("Esta transacción ya fue registrada.");

  const totalDebit = entries.reduce((s, e) => s + n2(e.debit), 0);
  const totalCredit = entries.reduce((s, e) => s + n2(e.credit), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error("Transacción no balanceada");
  }

  const isPayment = entries.some(e => e.transactionType === "payment");

  const invoiceNumber = entries[0]?.invoice_number ?? "";
  const normalizedInvoice = normalizeInvoiceNumber(invoiceNumber);

  if (normalizedInvoice && !isPayment) {
    const exists = await invoiceAlreadyExists(entityId, normalizedInvoice);
    if (exists) throw new Error(`Factura ${invoiceNumber} ya registrada`);
  }

  const isPurchase = entries.some(e =>
    isExpenseLine(e) ||
    isStrictPayableInvoiceControl(e.account_code)
  );

  const transactionNature: "purchase" | "sale" =
    isPurchase ? "purchase" : "sale";

  const col = collection(db, "entities", entityId, "journalEntries");
  const batch = writeBatch(db);

  const saved: JournalEntry[] = [];

  for (const e of entries) {
    const id = e.id ?? doc(col).id;

    const normalizedDate = e.date?.slice(0, 10);
    if (!normalizedDate) throw new Error("Fecha inválida");

    if (!e.transactionType) {
      console.warn("⚠️ Missing transactionType, defaulting to invoice", e);
    }

    const inferredType =
      e.transactionType === "payment" ||
      e.transactionType === "transfer"
        ? e.transactionType
        : "invoice";

    const entry: JournalEntry = {
      ...e,
      id,
      entityId,
      uid: userIdSafe,

      debit: n2(e.debit),
      credit: n2(e.credit),

      account_code: norm(e.account_code),
      account_name: String(e.account_name ?? "").trim(),

      invoice_number: e.invoice_number ?? "",
      invoice_number_normalized: normalizeInvoiceNumber(e.invoice_number ?? ""),

      date: normalizedDate,
      description: e.description ?? "Asiento automático",

      source: e.source ?? "manual",

      transactionType: inferredType,
      documentNature: transactionNature,

      transactionId: txId,

      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    requireNonEmpty(entry.account_code, "account_code");

    batch.set(doc(col, id), entry);
    saved.push(entry);
  }

  await batch.commit();

  try {
    await updateAccountBalancesFromJournalEntries(entityId, saved);
  } catch (err) {
    console.error("⚠️ Balance update failed", err);
  }

  const hasPayable = saved.some(
    e =>
      e.transactionType === "invoice" &&
      isStrictPayableInvoiceControl(e.account_code) &&
      n2(e.credit) > 0
  );

  const isInitial = saved.some(e => e.source === "initial");

  if (!isInitial && !isPayment && hasPayable) {
    await syncPayablesFromJournal(entityId, saved);
  }

  return saved;
}

/* =============================================================================
   PAYMENT
============================================================================= */

export async function createPayablePaymentJournalEntry(
  entityId: string,
  payable: Payable,
  amountPaid: number,
  paymentDate: string,
  bankAccount: { account_code: string; name?: string },
  userIdSafe: string,
  options?: { retentionIR?: number; retentionIVA?: number }
) {

  requireEntityId(entityId, "pago proveedor");

  const retentionIR = n2(options?.retentionIR ?? 0);
  const retentionIVA = n2(options?.retentionIVA ?? 0);

  const amount = n2(amountPaid);
  if (amount <= 0) throw new Error("Monto inválido");

  const totalApplied = n2(amount + retentionIR + retentionIVA);

  if (totalApplied > n2(payable.balance)) {
    throw new Error("Pago excede saldo");
  }

  const tx = doc(collection(db, "entities", entityId, "journalEntries")).id;

  const entries: JournalEntry[] = [
    {
      entityId,
      transactionId: tx,
      date: paymentDate,
      account_code: payable.account_code,
      account_name: payable.account_name,
      debit: totalApplied,
      credit: 0,
      invoice_number: payable.invoiceNumber,
      description: "Pago a proveedor",
      transactionType: "payment",
      documentNature: "purchase",
      source: "manual",
    },
    {
      entityId,
      transactionId: tx,
      date: paymentDate,
      account_code: bankAccount.account_code,
      account_name: bankAccount.name ?? "Banco",
      debit: 0,
      credit: amount,
      description: "Salida de banco",
      transactionType: "payment",
      documentNature: "purchase",
      source: "manual",
    },
  ];

  if (retentionIR > 0) {
    entries.push({
      entityId,
      transactionId: tx,
      date: paymentDate,
      account_code: "201020201",
      account_name: "Retenciones IR por pagar",
      debit: 0,
      credit: retentionIR,
      description: "Retención IR",
      transactionType: "payment",
      documentNature: "purchase",
      source: "manual",
    });
  }

  if (retentionIVA > 0) {
    entries.push({
      entityId,
      transactionId: tx,
      date: paymentDate,
      account_code: "201020202",
      account_name: "Retenciones IVA por pagar",
      debit: 0,
      credit: retentionIVA,
      description: "Retención IVA",
      transactionType: "payment",
      documentNature: "purchase",
      source: "manual",
    });
  }

  await saveJournalEntries(entityId, userIdSafe, entries);
  await applyPayablePayment(entityId, payable, totalApplied);

  await createBankMovement({
  entityId,
  bankAccountId: bankAccount.account_code, // temporary mapping (see note below)

  relatedJournalTransactionId: tx, // ✅ FIXED

  amount,
  date: paymentDate,

  type: "withdrawal",
  description: "Pago a proveedor",
});

  return tx;
}

/* =============================================================================
   FETCH + HELPERS (UNCHANGED CORE)
============================================================================= */

export async function fetchJournalEntriesByTransactionId(
  entityId: string,
  transactionId: string
): Promise<JournalEntry[]> {

  requireEntityId(entityId, "buscar journal");

  const col = collection(db, "entities", entityId, "journalEntries");

  const q = query(
    col,
    where("transactionId", "==", transactionId),
    limit(200)
  );

  const snap = await getDocs(q);

  return snap.docs.map(d => ({
    id: d.id,
    ...(d.data() as JournalEntry),
  }));
}

export async function invoiceAlreadyExists(
  entityId: string,
  invoiceNumber: string
): Promise<boolean> {

  const normalized = normalizeInvoiceNumber(invoiceNumber);
  if (!normalized) return false;

  const col = collection(db, "entities", entityId, "journalEntries");

  const q = query(
    col,
    where("invoice_number_normalized", "==", normalized),
    limit(1)
  );

  const snap = await getDocs(q);

  return !snap.empty;
}

export async function fetchJournalEntries(
  entityId: string
): Promise<JournalEntry[]> {

  requireEntityId(entityId, "cargar journal");

  const col = collection(db, "entities", entityId, "journalEntries");

  const q = query(col, orderBy("date", "desc"), limit(2000));

  const snap = await getDocs(q);

  return snap.docs.map(d => {
    const data = d.data() as JournalEntry;

    if (!data.documentNature || !["sale", "purchase"].includes(data.documentNature)) {
      data.documentNature =
        data.account_code?.startsWith("5") ||
        data.account_code?.startsWith("2")
          ? "purchase"
          : "sale";
    }

    return { id: d.id, ...data };
  });
}

// ============================================================================
// ANNUL JOURNAL TRANSACTION (USED BY PAYABLES / RECEIVABLES)
// ============================================================================

export async function annulInvoiceByTransaction(
  entityId: string,
  transactionId: string
): Promise<void> {

  requireEntityId(entityId, "anular transacción");

  if (!transactionId?.trim()) {
    throw new Error("transactionId requerido");
  }

  const entries = await fetchJournalEntriesByTransactionId(
    entityId,
    transactionId
  );

  if (!entries.length) return;

  const col = collection(db, "entities", entityId, "journalEntries");
  const batch = writeBatch(db);

  for (const e of entries) {
    if (!e.id) continue;
    batch.delete(doc(col, e.id));
  }

  await batch.commit();
}

// ============================================================================
// FETCH JOURNAL ENTRIES BY DATE RANGE
// ============================================================================

export async function fetchJournalEntriesByDateRange(
  entityId: string,
  startDate: string,
  endDate: string
): Promise<JournalEntry[]> {

  requireEntityId(entityId, "cargar journal por rango de fechas");

  if (!startDate || !endDate) {
    throw new Error("Fechas requeridas");
  }

  const col = collection(db, "entities", entityId, "journalEntries");

  const q = query(
    col,
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date", "desc"),
    limit(2000)
  );

  const snap = await getDocs(q);

  return snap.docs.map(d => ({
    id: d.id,
    ...(d.data() as JournalEntry),
  }));
}
// ============================================================================
// CREATE BANK TRANSFER JOURNAL ENTRY
// ============================================================================

export async function createTransferJournalEntry(
  entityId: string,
  userIdSafe: string,
  fromAccount: { account_code: string; name?: string },
  toAccount: { account_code: string; name?: string },
  amount: number,
  date: string,
  description?: string
): Promise<string> {

  requireEntityId(entityId, "transferencia bancaria");

  const value = n2(amount);

  if (value <= 0) {
    throw new Error("Monto inválido para transferencia");
  }

  const tx = doc(collection(db, "entities", entityId, "journalEntries")).id;

  const entries: JournalEntry[] = [
    {
      entityId,
      transactionId: tx,
      date,
      account_code: norm(fromAccount.account_code),
      account_name: fromAccount.name ?? "Banco origen",
      debit: 0,
      credit: value,
      description: description ?? "Transferencia bancaria",
      transactionType: "transfer",
      documentNature: "sale",
      source: "manual",
    },
    {
      entityId,
      transactionId: tx,
      date,
      account_code: norm(toAccount.account_code),
      account_name: toAccount.name ?? "Banco destino",
      debit: value,
      credit: 0,
      description: description ?? "Transferencia bancaria",
      transactionType: "transfer",
      documentNature: "sale",
      source: "manual",
    },
  ];

  await saveJournalEntries(entityId, userIdSafe, entries);

  return tx;
}