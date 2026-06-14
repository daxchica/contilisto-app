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
import { defaultIRCode, defaultIVACode } from "@/constants/sriRetentionCodes";
import type { AccountingDocument } from "@/types/AccountingDocument";

import { upsertPayable, applyPayablePayment } from "./payablesService";

import {
  createBankMovement,
} from "./bankMovementService";

import { requireEntityId } from "./requireEntityId";
import { deleteInvoicesFromFirestoreLog } from "./firestoreLogService";
import { requireNonEmpty } from "./requireNonEmpty";
import { getNextJournalId } from "./journalCounterService";
import {
  savePersonalExpenseRecord,
  deletePersonalExpensesByTransaction,
} from "./personalExpenseStorageService";
import { SRI_CATEGORIES } from "./personalExpensesService";
import type { PersonalExpenseRecord } from "@/types/PersonalExpenseRecord";
import type { SriCategoryKey } from "./personalExpensesService";

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
// PERSONAL EXPENSE DETECTION + EXTRACTION
// ============================================================================

const PERSONAL_TAG_RE = /^\[Personal:\s*([^\]]+)\]/i;

/** Returns true if ANY entry in the transaction is tagged [Personal: X] */
function isPersonalExpenseTransaction(entries: JournalEntry[]): boolean {
  return entries.some((e) => PERSONAL_TAG_RE.test(e.description ?? ""));
}

/** Extracts a PersonalExpenseRecord from a set of journal entries.
 *  Must only be called when isPersonalExpenseTransaction() returns true. */
function extractPersonalExpenseRecord(
  entries: JournalEntry[],
  entityId: string,
  uid: string
): PersonalExpenseRecord {
  let category: SriCategoryKey = "Otros";
  let rawDescription = "";

  for (const e of entries) {
    const m = PERSONAL_TAG_RE.exec(e.description ?? "");
    if (m) {
      const key = m[1].trim();
      const found = SRI_CATEGORIES.find(
        (c) => c.key.toLowerCase() === key.toLowerCase()
      );
      category = (found?.key ?? "Otros") as SriCategoryKey;
      rawDescription = (e.description ?? "").replace(PERSONAL_TAG_RE, "").trim();
      break;
    }
  }

  // Base: sum of 5xx / 6xx debit lines
  let amount = n2(
    entries
      .filter((e) => {
        const code = norm(e.account_code);
        return (code.startsWith("5") || code.startsWith("6")) && n2(e.debit) > 0;
      })
      .reduce((s, e) => s + n2(e.debit), 0)
  );

  // IVA: sum of 133xxx debit lines
  const iva = n2(
    entries
      .filter((e) => norm(e.account_code).startsWith("133") && n2(e.debit) > 0)
      .reduce((s, e) => s + n2(e.debit), 0)
  );

  // Fallback if no expense account lines (e.g. direct bank entry)
  if (amount === 0) {
    amount = n2(
      entries
        .filter((e) => {
          const code = norm(e.account_code);
          return (
            n2(e.debit) > 0 &&
            !code.startsWith("1") &&
            !code.startsWith("133")
          );
        })
        .reduce((s, e) => s + n2(e.debit), 0)
    );
  }

  const first = entries[0];
  const invoiceNumber = first.invoice_number ?? "";

  return {
    id: crypto.randomUUID(),
    entityId,
    uid,
    transactionId: first.transactionId,
    invoice_number: invoiceNumber,
    invoice_number_normalized: invoiceNumber.replace(/\s+/g, "").toUpperCase(),
    date: String(first.date ?? "").slice(0, 10),
    category,
    description: rawDescription,
    supplierName:
      first.supplier_name ?? first.issuerName ?? first.customer_name ?? "-",
    supplierRUC:
      first.supplier_ruc ?? first.issuerRUC ?? first.buyerRUC ?? "-",
    amount,
    iva,
    total: n2(amount + iva),
    createdAt: Date.now(),
  };
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
  document?: AccountingDocument,
  monthlyLimit?: number
): Promise<JournalEntry[]> {

  requireEntityId(entityId, "guardar diario");

  if (!userIdSafe?.trim()) throw new Error("UID requerido");
  if (!entries?.length) throw new Error("No entries provided");

  // ── Plan limit: count unique transactions this month ──
  if (monthlyLimit !== undefined && monthlyLimit > 0) {
    const used = await countMonthlyTransactions(entityId);
    if (used >= monthlyLimit) {
      throw new Error(
        `Límite de ${monthlyLimit} asientos mensuales alcanzado. Actualiza tu plan para continuar.`
      );
    }
  }

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

  // ── Personal expense early-exit: route to dedicated collection ────────────
  // Transactions tagged [Personal: X] must NOT enter journalEntries so they
  // never affect financial statements, account balances, or tax ledgers.
  if (isPersonalExpenseTransaction(entries)) {
    const record = extractPersonalExpenseRecord(entries, entityId, userIdSafe);
    await savePersonalExpenseRecord(entityId, record);
    // Return the entries as-is so the caller (preview modal) can log the invoice
    return entries;
  }

  const isPayment = entries.some(e => e.transactionType === "payment");

  const invoiceNumber = entries[0]?.invoice_number ?? "";
  const normalizedInvoice = normalizeInvoiceNumber(invoiceNumber);

  const skipDuplicateInvoiceCheck = entries.some(
    (e) =>
      e.transactionType === "payment" ||
      e.transactionType === "transfer" ||
      e.transactionType === "initial_balance"
  );

  if (normalizedInvoice && !skipDuplicateInvoiceCheck) {
    const exists = await invoiceAlreadyExists(entityId, normalizedInvoice);
    if (exists) throw new Error(`Factura ${invoiceNumber} ya registrada`);
  }

  const isPurchase = entries.some(e =>
    isExpenseLine(e) ||
    isStrictPayableInvoiceControl(e.account_code)
  );

  const transactionNature: "purchase" | "sale" =
    isPurchase ? "purchase" : "sale";

  // Assign a sequential human-readable ID shared by all lines of this transaction.
  const journalId = await getNextJournalId(entityId);

  const col = collection(db, "entities", entityId, "journalEntries");
  const batch = writeBatch(db);

  const saved: JournalEntry[] = [];

  for (const e of entries) {
    const id = e.id ?? doc(col).id;

    const rawDate = e.date ?? "";
    // Convert DD/MM/YYYY → YYYY-MM-DD if needed
    const normalizedDate = /^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)
      ? `${rawDate.slice(6, 10)}-${rawDate.slice(3, 5)}-${rawDate.slice(0, 2)}`
      : rawDate.slice(0, 10);
    if (!normalizedDate) throw new Error("Fecha inválida");

    if (!e.transactionType) {
      console.warn("⚠️ Missing transactionType, defaulting to invoice", e);
    }

    const inferredType =
      e.transactionType === "initial_balance" ||
      e.transactionType === "invoice" ||
      e.transactionType === "payment" ||
      e.transactionType === "transfer"
        ? e.transactionType
        : "invoice";

    const inferredNature =
      e.documentNature ??
      (inferredType === "initial_balance"
        ? "opening"
        : inferredType === "transfer" || inferredType === "payment"
          ? "cash"
          : transactionNature);

    const entry: JournalEntry = {
      ...e,
      id,
      entityId,
      uid: userIdSafe,

      journalId,

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
      documentNature: inferredNature,

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
  options?: {
    retentionIR?: number;
    retentionIVA?: number;
    /** Supplier RUC — needed for Form 103/104 retention reports */
    supplierRUC?: string;
    /** Taxable base of the original invoice (expense amount, excl. IVA) */
    expenseBase?: number;
    /** IVA amount of the original invoice */
    invoiceIVA?: number;
    /** IR retention percentage selected by the user (e.g. 1, 2, 10).
     *  When provided, the authoritative base is derived from retentionIR / (irPercent/100)
     *  instead of expenseBase, which avoids 12.88%-style mismatches caused by
     *  slight base-amount discrepancies. */
    irPercent?: number | null;
    /** IVA retention percentage selected by the user (e.g. 30, 70, 100). */
    ivaPercent?: number | null;
    /** Explicit SRI IR retention code selected by the user (e.g. "312", "303").
     *  When provided this overrides the percentage-derived code. */
    irCode?: string | null;
    /** Explicit SRI IVA retention code selected by the user (e.g. "3", "7"). */
    ivaCode?: string | null;
  }
) {

  requireEntityId(entityId, "pago proveedor");

  const retentionIR  = n2(options?.retentionIR  ?? 0);
  const retentionIVA = n2(options?.retentionIVA ?? 0);
  const supplierRUC  = options?.supplierRUC?.trim() ?? "";
  const expenseBase  = n2(options?.expenseBase ?? 0);
  const invoiceIVA   = n2(options?.invoiceIVA  ?? 0);
  const irPercent    = options?.irPercent  ?? null;
  const ivaPercent   = options?.ivaPercent ?? null;
  const irCode       = options?.irCode?.trim()  || null;
  const ivaCode      = options?.ivaCode?.trim() || null;

  const amount = n2(amountPaid);

  const totalApplied = n2(amount + retentionIR + retentionIVA);

  // Allow amount = 0 when retentions alone cover the payment (retention-only entry)
  if (amount < 0) throw new Error("El pago por banco no puede ser negativo.");
  if (totalApplied <= 0) throw new Error("El valor total aplicado debe ser mayor que cero.");

  if (totalApplied > n2(payable.balance) + 0.01) {
    throw new Error("Pago excede saldo");
  }

  const tx = doc(collection(db, "entities", entityId, "journalEntries")).id;

  const paymentDesc = payable.supplierName
    ? `Pago fact. ${payable.invoiceNumber} — ${payable.supplierName}`
    : `Pago fact. ${payable.invoiceNumber}`;

  // ── Build per-line retention detail (tax.retenciones[]) ─────────────────
  // When irCode is provided (user selected a concept), use it directly.
  // Otherwise fall back to percentage-derived default code.

  const retenciones: Array<{
    taxType: "IVA" | "RENTA";
    code: string;
    percentage: number;
    base: number;
    amount: number;
  }> = [];

  if (retentionIR > 0) {
    // Prefer irPercent (user's explicit selection) to compute base.
    // Fall back to expenseBase if no percent was chosen.
    const pct = irPercent != null && irPercent > 0 ? irPercent : null;
    const base =
      pct != null
        ? n2(retentionIR / (pct / 100))
        : expenseBase > 0
          ? expenseBase
          : 0;
    const usedPct = pct ?? (base > 0 ? n2((retentionIR / base) * 100) : 0);
    // Use explicit code if provided, otherwise derive from percentage
    const usedCode = irCode ?? defaultIRCode(usedPct);
    retenciones.push({
      taxType: "RENTA",
      code: usedCode,
      percentage: usedPct,
      base,
      amount: retentionIR,
    });
  }

  if (retentionIVA > 0) {
    const pct = ivaPercent != null && ivaPercent > 0 ? ivaPercent : null;
    const base =
      pct != null
        ? n2(retentionIVA / (pct / 100))
        : invoiceIVA > 0
          ? invoiceIVA
          : 0;
    const usedPct = pct ?? (base > 0 ? n2((retentionIVA / base) * 100) : 0);
    // Use explicit code if provided, otherwise derive from percentage
    const usedCode = ivaCode ?? defaultIVACode(usedPct);
    retenciones.push({
      taxType: "IVA",
      code: usedCode,
      percentage: usedPct,
      base,
      amount: retentionIVA,
    });
  }

  // Tax metadata stored on the AP-debit line so the tax engine can recover
  // the original invoice base and IVA when building retention reports.
  const taxMeta: JournalEntry["tax"] | undefined =
    expenseBase > 0 || retenciones.length > 0
      ? {
          ...(expenseBase > 0
            ? { bases: [{ rate: 12, base: expenseBase, iva: invoiceIVA }] }
            : {}),
          ...(retenciones.length > 0 ? { retenciones } : {}),
        }
      : undefined;

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
      supplier_name: payable.supplierName,
      supplier_ruc: supplierRUC || undefined,
      description: paymentDesc,
      transactionType: "payment",
      documentNature: "purchase",
      source: "manual",
      tax: taxMeta,
    },
  ];

  // Only add a bank credit entry when actual cash is being transferred
  if (amount > 0) {
    entries.push({
      entityId,
      transactionId: tx,
      date: paymentDate,
      account_code: bankAccount.account_code,
      account_name: bankAccount.name ?? "Banco",
      debit: 0,
      credit: amount,
      invoice_number: payable.invoiceNumber,
      supplier_name: payable.supplierName,
      supplier_ruc: supplierRUC || undefined,
      description: paymentDesc,
      transactionType: "payment",
      documentNature: "purchase",
      source: "manual",
    });
  }

  if (retentionIR > 0) {
    entries.push({
      entityId,
      transactionId: tx,
      date: paymentDate,
      account_code: "201020201",
      account_name: "Retenciones IR por pagar",
      debit: 0,
      credit: retentionIR,
      invoice_number: payable.invoiceNumber,
      supplier_name: payable.supplierName,
      supplier_ruc: supplierRUC || undefined,
      description: `Retención IR — ${payable.invoiceNumber}`,
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
      invoice_number: payable.invoiceNumber,
      supplier_name: payable.supplierName,
      supplier_ruc: supplierRUC || undefined,
      description: `Retención IVA — ${payable.invoiceNumber}`,
      transactionType: "payment",
      documentNature: "purchase",
      source: "manual",
    });
  }

  await saveJournalEntries(entityId, userIdSafe, entries);
  await applyPayablePayment(entityId, payable, totalApplied, userIdSafe, tx);

  // Only register a bank movement when cash actually left the account
  if (amount > 0) {
    await createBankMovement({
      entityId,
      bankAccountId: bankAccount.account_code,
      relatedJournalTransactionId: tx,
      amount,
      date: paymentDate,
      type: "withdrawal",
      description: paymentDesc,
    });
  }

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

/**
 * Returns true if any journal entry for this invoice already credits a
 * retention account (201020201 = Ret IR por pagar, 201020202 = Ret IVA por pagar).
 * Queries by invoice_number_normalized so it catches both the original invoice
 * entry AND any subsequent payment entries that share the same invoice number.
 */
export async function checkRetentionsRecorded(
  entityId: string,
  invoiceNumber: string
): Promise<boolean> {
  const normalized = normalizeInvoiceNumber(invoiceNumber);
  if (!normalized) return false;

  const col = collection(db, "entities", entityId, "journalEntries");

  const q = query(
    col,
    where("invoice_number_normalized", "==", normalized),
    limit(200)
  );

  const snap = await getDocs(q);

  return snap.docs.some((d) => {
    const data = d.data() as JournalEntry;
    const code = String(data.account_code ?? "").replace(/\./g, "").trim();
    const credit = Number(data.credit ?? 0);
    return (
      credit > 0 &&
      (code.startsWith("201020201") || code.startsWith("201020202"))
    );
  });
}

// ============================================================================
// MONTHLY TRANSACTION COUNTER — used to enforce plan limits
// ============================================================================

export async function countMonthlyTransactions(entityId: string): Promise<number> {
  requireEntityId(entityId, "contar transacciones del mes");

  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const year = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const month = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
  const endOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;

  const col = collection(db, "entities", entityId, "journalEntries");
  const q = query(
    col,
    where("date", ">=", startOfMonth),
    where("date", "<",  endOfMonth)
  );

  const snap = await getDocs(q);
  const uniqueTxIds = new Set(
    snap.docs.map(d => (d.data() as JournalEntry).transactionId).filter(Boolean)
  );
  return uniqueTxIds.size;
}

/**
 * Find the Cuentas por Cobrar (AR) account code used on the original sale
 * journal entry for a given invoice number.
 *
 * Looks for a journal entry with a DEBIT on an account starting with "101030"
 * (standard NEC receivables prefix) that matches the invoice number.
 * Returns null when no such entry exists.
 */
export async function findARAccountForInvoice(
  entityId: string,
  invoiceNumber: string,
): Promise<{ code: string; name: string } | null> {
  if (!entityId || !invoiceNumber) return null;

  const normalized = normalizeInvoiceNumber(invoiceNumber);
  if (!normalized) return null;

  const col = collection(db, "entities", entityId, "journalEntries");
  const q   = query(col, where("invoice_number_normalized", "==", normalized), limit(50));
  const snap = await getDocs(q);

  for (const d of snap.docs) {
    const e = d.data() as JournalEntry;
    const code = (e.account_code ?? "").replace(/\./g, "");
    const debit = Number(e.debit ?? 0);

    // A debit on an account starting with 101030 = Cuentas por Cobrar
    if (debit > 0 && code.startsWith("101030")) {
      return { code, name: e.account_name ?? "Cuentas por Cobrar" };
    }
  }
  return null;
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

    if (!data.documentNature || !["sale", "purchase", "cash", "opening"].includes(data.documentNature)) {
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
  transactionId: string,
  invoiceNumber?: string
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

  // ── Also delete from personalExpenses (transaction may be there instead) ──
  deletePersonalExpensesByTransaction(entityId, transactionId).catch((err) =>
    console.warn("⚠️ Failed to clean personalExpenses after annulment:", err)
  );

  // ── Remove invoice log so the same invoice can be re-uploaded/re-processed ──
  // Collect all unique invoice numbers referenced in this transaction.
  const invoiceNumbers = Array.from(
    new Set(
      [
        invoiceNumber,
        ...entries.map((e) => e.invoice_number),
      ].filter((n): n is string => Boolean(n?.trim()))
    )
  );

  if (invoiceNumbers.length > 0) {
    // Non-blocking: log cleanup failure must never prevent the delete from succeeding
    deleteInvoicesFromFirestoreLog(entityId, invoiceNumbers).catch((err) =>
      console.warn("⚠️ Failed to clean invoice log after annulment:", err)
    );
  }
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
// FETCH INITIAL BALANCE DATE
// Returns the date of the opening balance entry, or null if none exists.
// ============================================================================

export async function fetchInitialBalanceDate(
  entityId: string
): Promise<string | null> {
  requireEntityId(entityId, "cargar fecha de saldo inicial");

  const txId = `INITIAL_BALANCE:${entityId}`;
  const col = collection(db, "entities", entityId, "journalEntries");

  const q = query(
    col,
    where("transactionId", "==", txId),
    limit(1)
  );

  const snap = await getDocs(q);

  if (snap.empty) return null;

  const data = snap.docs[0].data() as JournalEntry;
  return data.date ?? null;
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
      documentNature: "cash",
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

// ============================================================================
// CREATE RECEIVABLE COLLECTION JOURNAL ENTRY
// ============================================================================

export async function createReceivableCollectionJournalEntry(
  entityId: string,
  userIdSafe: string,
  bankAccount: { account_code: string; name?: string },
  receivableAccount: { account_code: string; name?: string },
  amountCollected: number,
  collectionDate: string,
  description?: string,
  options?: {
    bankMovementId?: string;
    invoiceNumber?: string;
  }
): Promise<string> {
  requireEntityId(entityId, "cobro cliente");

  if (!userIdSafe?.trim()) {
    throw new Error("UID requerido para cobro de cliente");
  }

  const amount = n2(amountCollected);

  if (amount <= 0) {
    throw new Error("Monto inválido para cobro de cliente");
  }

  if (!bankAccount.account_code?.trim()) {
    throw new Error("Cuenta bancaria contable requerida");
  }

  if (!receivableAccount.account_code?.trim()) {
    throw new Error("Cuenta por cobrar requerida");
  }

  const tx = doc(collection(db, "entities", entityId, "journalEntries")).id;

  const concept = description ?? "Cobro de cliente";
  const invoiceNumber = options?.invoiceNumber ?? "";

  const entries: JournalEntry[] = [
    {
      entityId,
      uid: userIdSafe,
      transactionId: tx,
      transactionType: "payment",
      documentNature: "sale",

      date: collectionDate,
      account_code: norm(bankAccount.account_code),
      account_name: bankAccount.name ?? "Banco",
      
      debit: amount,
      credit: 0,
      
      description: concept,
      invoice_number: invoiceNumber,
      bankMovementId: options?.bankMovementId,

      source: "manual",
    },
    {
      entityId,
      uid: userIdSafe,
      transactionId: tx,
      transactionType: "payment",
      documentNature: "sale",

      date: collectionDate,
      account_code: norm(receivableAccount.account_code),
      account_name: receivableAccount.name ?? "Cuentas por cobrar",
      
      debit: 0,
      credit: amount,
      
      description: concept,
      invoice_number: invoiceNumber,
      bankMovementId: options?.bankMovementId,

      source: "manual",
    },
  ];

  await saveJournalEntries(entityId, userIdSafe, entries);

  await createBankMovement({
    entityId,
    bankAccountId: bankAccount.account_code,
    relatedJournalTransactionId: tx,
    amount,
    date: collectionDate,
    type: "deposit",
    description: description ?? "Cobro de cliente",
  } as any);

  return tx;
}