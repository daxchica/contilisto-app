// src/services/journalService.ts

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
import { createBankMovement, linkJournalTransaction } from "./bankMovementService";

/* =============================================================================
   HELPERS
============================================================================= */

function stripUndefined<T>(value: T): T {
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

/* =============================================================================
   CONTROL ACCOUNT HELPERS (ROBUST)
============================================================================= */

const RECEIVABLE_PREFIXES = ["10102", "130101"];
const PAYABLE_PREFIXES = ["201", "211"];

function isCustomerReceivableAccount(code?: string) {
  const c = norm(code);
  return RECEIVABLE_PREFIXES.some(p => c.startsWith(p));
}

function isSupplierPayableAccount(code?: string) {
  const c = norm(code);
  return PAYABLE_PREFIXES.some(p => c.startsWith(p));
}

function duplicateKey(e: JournalEntry) {
  return `${e.entityId}::${e.invoice_number}::${e.account_code}::${e.debit}::${e.credit}`;
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
  const col = collection(db, "entities", entityId, "journalEntries");
  if (!entityId) return [];

  try {
    const snap = await getDocs(col);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as JournalEntry) }));
  } catch (err) {
    console.warn("fetchJournalEntries blocked:", err);
    return [];
  }
}

export async function fetchJournalEntriesByTransactionId(
  entityId: string,
  transactionId: string
): Promise<JournalEntry[]> {
  const col = collection(db, "entities", entityId, "journalEntries");
  const qTx = query(col, where("transactionId", "==", transactionId));
  const snap = await getDocs(qTx);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as JournalEntry) }));
}

/* =============================================================================
   INTERNAL SYNC (Journal → AP / AR)
============================================================================= */

async function syncPayablesFromJournal(entityId: string, saved: JournalEntry[]) {
  const lines = saved.filter(
    e => Number(e.credit) > 0
  );

  const grouped = new Map<string, JournalEntry[]>();
  for (const e of lines) {
    if (!e.transactionId) continue;
    if (!grouped.has(e.transactionId)) grouped.set(e.transactionId, []);
    grouped.get(e.transactionId)!.push(e);
  }

  for (const [tx, group] of grouped) {
    const control = group.find(e =>
      isSupplierPayableAccount(e.account_code)
    );

    const total = Number(
      group.reduce((s, e) => s + Number(e.credit || 0), 0).toFixed(2)
    );
    if (total <= 0) continue;

    const ref = control ?? group[0];

    await upsertPayable(entityId, {
      transactionId: tx,
      invoiceNumber: ref.invoice_number!,
      issueDate: ref.date,

      supplierName: ref.supplier_name || "Proveedor",
      supplierRUC: (ref as any).issuerRUC || "",

      account_code: ref.account_code || "201030102",
      account_name: ref.account_name || "Proveedores",

      total,
      paid: 0,

      termsDays: 30,
      installments: 1,

      createdFrom: "ai_journal",
    });
  }
}

async function syncReceivablesFromJournal(entityId: string, saved: JournalEntry[]) {
  const lines = saved.filter(
    e => Number(e.debit) > 0
  );

  const grouped = new Map<string, JournalEntry[]>();
  for (const e of lines) {
    if (!e.transactionId) continue;
    if (!grouped.has(e.transactionId)) grouped.set(e.transactionId, []);
    grouped.get(e.transactionId)!.push(e);
  }

  for (const [tx, group] of grouped) {
    const control = group.find(e =>
      isCustomerReceivableAccount(e.account_code)
    );

    const total = Number(
      group.reduce((s, e) => s + Number(e.debit || 0), 0).toFixed(2)
    );
    if (total <= 0) continue;

    const ref = control ?? group[0];
    const customerRUC = getCustomerRUC(ref);

    if (!customerRUC) {
      console.warn(`[AR FALLBACK] tx=${tx} missing customerRUC`);
      continue;
    }

    await upsertReceivable(entityId, {
      transactionId: tx,
      invoiceNumber: ref.invoice_number!,
      issueDate: ref.date,

      customerName: getCustomerName(ref) || "Cliente",
      customerRUC,

      account_code: ref.account_code || "13010101",
      account_name: ref.account_name || "Clientes",

      total,
      paid: 0,
      balance: total,

      termsDays: 30,
      installments: 1,

      status: "pending",
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
  if (!entityId) {
    throw new Error("saveJournalEntries: entityId is required");
  }

  if (!userId) {
    throw new Error("saveJournalEntries: userId (uid) is required");
  }

  const col = collection(db, "entities", entityId, "journalEntries");

  const existing: Record<string, boolean> = {};
  const saved: JournalEntry[] = [];
  const batch = writeBatch(db);
  const validEntries = entries.filter(
    e => Number(e.debit || 0) > 0 || Number(e.credit || 0) > 0
  );

  for (const e of validEntries) {
    const ref = doc(col);
    const id = e.id ?? ref.id;
    const transactionId = e.transactionId ?? ref.id;

    const entry: JournalEntry = {
      ...e,
      id,
      entityId,
      uid: userId,
      // userId,
      transactionId,
      invoice_number: resolveInvoiceNumber({ ...e, transactionId }),
      description: resolveDescription(e),
      createdAt: typeof (e as any).createdAt === "number" ? (e as any).createdAt : Date.now(),
    };

    // 🔒 HARD VALIDATION (before Firestore)
    if (!entry.uid) {
      throw new Error(`JournalEntry ${id} missing uid`);
    }

    if (!entry.entityId) {
      throw new Error(`JournalEntry ${id} missing entityId`);
    }

    const key = duplicateKey(entry);
    if (existing[key]) continue;

    batch.set(doc(col, id), stripUndefined(entry) as any);
    saved.push(entry);
    existing[key] = true;
  }

  if (saved.length) {
    await batch.commit();

    // 🔁 Infer invoice type from control accounts
    const hasPayable = saved.some(e => isSupplierPayableAccount(e.account_code));
    const hasReceivable = saved.some(e => isCustomerReceivableAccount(e.account_code));

    if (hasPayable) {
      await syncPayablesFromJournal(entityId, saved);
    }

    if (hasReceivable) {
      await syncReceivablesFromJournal(entityId, saved);
    }
  }

  return saved;
}

/* =============================================================================
   DELETE
============================================================================= */

export async function deleteJournalEntriesByTransactionId(
  entityId: string,
  transactionId: string
) {
  const col = collection(db, "entities", entityId, "journalEntries");
  const qTx = query(col, where("transactionId", "==", transactionId));
  const snap = await getDocs(qTx);

  const batch = writeBatch(db);
  snap.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

/* =============================================================================
   PAYABLE PAYMENT (AP → BANK)
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
  if (!payable.account_code) {
    throw new Error("Payable sin cuenta contable. Debe repararse.");
  }

  if (amount <= 0 || amount > payable.balance) {
    throw new Error("Monto inválido");
  }

  const tx =
    options?.bankMovementId ??
    doc(collection(db, "entities", entityId, "journalEntries")).id;

  const description = `Pago a proveedor ${payable.supplierName} — Factura ${payable.invoiceNumber}`;

  const entries: JournalEntry[] = [
    {
      entityId,
      transactionId: tx,
      date: paymentDate,
      account_code: payable.account_code,
      account_name: payable.account_name,
      debit: amount,
      credit: 0,
      invoice_number: payable.invoiceNumber,
      supplier_name: payable.supplierName,
      description,
      source: "manual",
    },
    {
      entityId,
      transactionId: tx,
      date: paymentDate,
      account_code: bankAccount.account_code,
      account_name: bankAccount.name || "Banco",
      debit: 0,
      credit: amount,
      invoice_number: payable.invoiceNumber,
      supplier_name: payable.supplierName,
      description,
      source: "manual",
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
  });

  await linkJournalTransaction(entityId, bankMovementId, tx);
  await applyPayablePayment(entityId, payable, amount);

  return tx;
}