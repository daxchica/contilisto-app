// ============================================================================
// src/services/journalService.ts
// Central Journal Service — CONTILISTO v1.0
// Handles journal entries, duplicate protection, payables sync,
// and payable payments derived from bank movements.
// ============================================================================

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
import crypto from "crypto";

import type { JournalEntry } from "../types/JournalEntry";
import type { Payable } from "@/types/Payable";
import { upsertPayable, applyPayablePayment } from "./payablesService";

/* ---------------------------------------------------------------------------
 * Payable payment options (traceability)
 * ---------------------------------------------------------------------------
 * NOTE:
 * - This is intentionally local to avoid circular dependencies.
 * - It allows linking Bank Movements → Journal Transactions.
 * - Not yet persisted in JournalEntry (future extension).
 * ---------------------------------------------------------------------------
 */
type PayablePaymentOptions = {
  /**
   * Bank movement ID that originated this payment.
   * TODO: Persist once JournalEntry includes bankMovementId?: string
   */
  bankMovementId?: string;
  /**
   * Optional override for description
   */
  descriptionOverride?: string;
};

/* ---------------------------------------------------------------------------
 * Remove undefined values recursively (Firestore-safe)
 * ---------------------------------------------------------------------------
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as any;
  }

  if (value && typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out;
  }

  if (typeof value === "number" && Number.isNaN(value)) {
    return 0 as any;
  }

  return value;
}

/* ---------------------------------------------------------------------------
 * FETCH ENTRIES FOR AN ENTITY
 * ---------------------------------------------------------------------------
 */
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

/* ---------------------------------------------------------------------------
 * SAVE ENTRIES WITH DUPLICATE PROTECTION
 * ---------------------------------------------------------------------------
 */
export async function saveJournalEntries(
  entityId: string,
  entries: JournalEntry[],
  userId: string
): Promise<JournalEntry[]> {
  if (!entityId || !entries.length) return [];

  const colRef = collection(db, "entities", entityId, "journalEntries");

  // ===== Detect duplicates by invoice + account + amounts =====
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

  // ===== Save entries =====
  const saved: JournalEntry[] = [];

  for (const e of entries) {
    const id =
      typeof e.id === "string" && e.id.trim()
        ? e.id
        : crypto.randomUUID();

    const transactionId =
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
    if (existing[key]) continue;

    const cleanEntry = stripUndefined(entry);
    await setDoc(doc(colRef, id), cleanEntry as JournalEntry);
    saved.push(cleanEntry as JournalEntry);
  }

  // =====================================================================
  // CREATE / UPDATE PAYABLES (1 transactionId = 1 Accounts Payable)
  // =====================================================================
  const normalizeAccountCode = (code: string) =>
    code.replace(/\./g, "").trim();

  const isSupplierPayableAccount = (accountCode?: string) => {
    if (!accountCode) return false;
    const c = normalizeAccountCode(accountCode);
    return c.startsWith("211") || c.startsWith("20101") || c.startsWith("2");
  };

  const payableLines = saved.filter(
    (e) =>
      typeof e.transactionId === "string" &&
      e.transactionId.trim() &&
      isSupplierPayableAccount(e.account_code) &&
      Number(e.credit || 0) > 0
  );

  if (payableLines.length > 0) {
    const byTx = new Map<string, JournalEntry[]>();
    for (const line of payableLines) {
      const key = line.transactionId!;
      if (!byTx.has(key)) byTx.set(key, []);
      byTx.get(key)!.push(line);
    }

    for (const [transactionId, lines] of byTx.entries()) {
      const total = Number(
        lines.reduce((sum, e) => sum + Number(e.credit || 0), 0).toFixed(2)
      );

      const ref = lines[0];

      await upsertPayable(entityId, {
        transactionId,
        invoiceNumber: (ref.invoice_number || "").trim(),
        issueDate: ref.date,
        supplierName: ref.supplier_name || ref.issuerName || "Proveedor",
        supplierRUC: ref.issuerRUC || "",
        total,
        termsDays: 30,
        installments: 1,
        paid: 0,
        createdFrom: "ai_journal",
      });
    }
  }

  return saved;
}

/* ---------------------------------------------------------------------------
 * DELETE ENTRIES BY TRANSACTION ID (rollback)
 * ---------------------------------------------------------------------------
 */
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

/* ---------------------------------------------------------------------------
 * CREATE JOURNAL ENTRY FOR PAYABLE PAYMENT
 * ---------------------------------------------------------------------------
 * ACCOUNTING RULE:
 * - Debit: Accounts Payable
 * - Credit: Bank Account
 * - Each payment is a NEW transactionId
 * - Derived from a real bank movement
 * ---------------------------------------------------------------------------
 */
export async function createPayablePaymentJournalEntry(
  entityId: string,
  payable: Payable,
  amount: number,
  paymentDate: string,
  bankAccountCode: string,
  userId: string,
  options?: PayablePaymentOptions
) {
  if (!entityId) throw new Error("entityId faltante");
  if (!userId) throw new Error("userId faltante");
  if (!payable?.id) throw new Error("payableId faltante");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Monto inválido");
  if (!paymentDate) throw new Error("Fecha requerida");
  if (!bankAccountCode) throw new Error("Cuenta bancaria requerida");

  if (Number(amount) > Number(payable.balance)) {
    throw new Error("El monto excede el saldo pendiente");
  }

  // ✅ ALWAYS generate a new transactionId for a payment
  const transactionId = crypto.randomUUID();

  const description =
    options?.descriptionOverride?.trim() ||
    `Pago a proveedor ${payable.supplierName} — Factura ${payable.invoiceNumber}`;

  const entries: JournalEntry[] = [
    {
      entityId,
      transactionId,
      date: paymentDate,
      account_code: "2.01.01",
      account_name: "Proveedores",
      debit: amount,
      credit: 0,
      description,
      invoice_number: payable.invoiceNumber,
      supplier_name: payable.supplierName,
      source: "manual",

      // Traceability: Bank Book → Journal
      bankMovementId: options?.bankMovementId,
      comment: options?.bankMovementId
        ? `bankMovementId=${options.bankMovementId}`
        : undefined,
    },
    {
      entityId,
      transactionId,
      date: paymentDate,
      account_code: bankAccountCode,
      account_name: "Banco",
      debit: 0,
      credit: amount,
      description,
      invoice_number: payable.invoiceNumber,
      supplier_name: payable.supplierName,
      source: "manual",

      bankMovementId: options?.bankMovementId,
      comment: options?.bankMovementId
        ? `bankMovementId=${options.bankMovementId}`
        : undefined,
    },
  ];

  await saveJournalEntries(entityId, entries, userId);
  await applyPayablePayment(entityId, payable, amount);

  return transactionId;
}