// ============================================================================
// src/services/receivablesService.ts
// Accounts Receivable — CONTILISTO v1.1 (Atomic Payments + Stability Improvements)
// ============================================================================

import { db } from "@/firebase-config";

import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  runTransaction,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";

import type { Receivable, ReceivableStatus } from "@/types/Receivable";
import type { JournalEntry } from "@/types/JournalEntry";

import {
  applyPaymentToInstallments,
  buildInstallmentSchedule,
} from "@/utils/payable";

import {
  fetchJournalEntriesByTransactionId,
  saveJournalEntries,
  annulInvoiceByTransaction,
} from "./journalService";

import {
  RECEIVABLE_PREFIXES,
  isCustomerReceivableAccount,
  isBankAccount,
} from "./controlAccounts";

import { requireEntityId } from "./requireEntityId";
import { requireNonEmpty } from "./requireNonEmpty";
import { createBankMovement } from "./bankMovementService";

/* ============================================================================
HELPERS
============================================================================ */

const n2 = (x: any) => {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const normAcc = (c?: string) => (c || "").replace(/\./g, "").trim();

const CONSUMIDOR_FINAL_ID = "9999999999999";
const CONSUMIDOR_FINAL_NAME = "CONSUMIDOR FINAL";

function normalizeCustomerName(name: string) {
  return name.replace(/\s+/g, " ").trim().toUpperCase();
}

function extractCustomerNameFromDescription(desc?: string): string | null {
  if (!desc) return null;
  const m = desc.match(/cliente\s*:\s*(.+)$/i);
  return m ? m[1].trim() : null;
}

function computeStatus(paid: number, total: number) {
  const balance = Math.max(0, n2(total - paid));

  if (balance <= 0) return { balance, status: "paid" as ReceivableStatus };
  if (paid > 0) return { balance, status: "partial" as ReceivableStatus };

  return { balance, status: "pending" as ReceivableStatus };
}

function assertTransactionId(tx: unknown): asserts tx is string {
  if (typeof tx !== "string" || !tx.trim()) {
    throw new Error("Receivable inválido: falta transactionId");
  }
}

function assertNotAnnulled(r: Pick<Receivable, "status">) {
  if ((r.status as any) === "annulled") {
    throw new Error("No permitido: la factura está anulada");
  }
}

function assertReceivableAccount(account_code?: string) {
  const c = normAcc(account_code);

  if (!c) throw new Error("Receivable requiere cuenta contable");

  if (!isCustomerReceivableAccount(c)) {
    throw new Error(`Cuenta inválida para CxC: ${account_code}`);
  }
}

/* ============================================================================
FETCH RECEIVABLE
============================================================================ */

export async function fetchReceivableByTransactionId(
  entityId: string,
  transactionId: string
): Promise<Receivable | null> {

  requireEntityId(entityId, "cargar CxC");

  const ref = doc(db, "entities", entityId, "receivables", transactionId);

  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return { id: snap.id, ...(snap.data() as Receivable) };
}

/* ============================================================================
FETCH RECEIVABLES
============================================================================ */

export async function fetchReceivables(entityId: string): Promise<Receivable[]> {

  requireEntityId(entityId, "cargar CxC");

  const colRef = collection(db, "entities", entityId, "receivables");

  const qRef = query(colRef, orderBy("issueDate", "desc"));

  const snap = await getDocs(qRef);

  return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({
    id: d.id,
    ...(d.data() as Receivable),
  }));
}

/* ============================================================================
UPSERT RECEIVABLE
============================================================================ */

export async function upsertReceivable(
  entityId: string,
  receivable: Omit<
    Receivable,
    "id" | "entityId" | "status" | "balance" | "createdAt" | "updatedAt"
  >
) {

  requireEntityId(entityId, "guardar CxC");

  assertTransactionId(receivable.transactionId);
  assertReceivableAccount(receivable.account_code);

  requireNonEmpty(receivable.account_code, "account code");

  const tx = receivable.transactionId;

  const ref = doc(db, "entities", entityId, "receivables", tx);

  const snap = await getDoc(ref);

  const existing = snap.exists() ? (snap.data() as Receivable) : null;

  if (existing) assertNotAnnulled(existing);

  const paid = n2((receivable as any).paid ?? existing?.paid ?? 0);
  const total = n2((receivable as any).total ?? existing?.total ?? 0);

  if (total <= 0) throw new Error("Receivable requiere total > 0");

  let customerName =
    (receivable as any).customerName ||
    (receivable as any).customer_name ||
    CONSUMIDOR_FINAL_NAME;

  let customerRUC =
    (receivable as any).customerRUC ||
    (receivable as any).customer_ruc ||
    CONSUMIDOR_FINAL_ID;

  customerName = normalizeCustomerName(customerName);

  const { balance, status } = computeStatus(paid, total);

  const payload: any = {
    ...(existing ?? {}),
    ...receivable,

    customer_name: customerName,
    customer_ruc: customerRUC,

    customerName,
    customerRUC,

    entityId,
    paid,
    total,
    balance,
    status,

    installmentSchedule:
      (receivable as any).installmentSchedule ??
      existing?.installmentSchedule ??
      buildInstallmentSchedule(
        total,
        receivable.issueDate,
        receivable.termsDays,
        receivable.installments
      ),

    updatedAt: serverTimestamp(),
    ...(existing ? {} : { createdAt: serverTimestamp() }),
  };

  delete payload.createdAt;

  await setDoc(ref, payload, { merge: true });
}

/* ============================================================================
ATOMIC RECEIVABLE PAYMENT
============================================================================ */

export async function applyReceivablePayment(
  entityId: string,
  receivable: Receivable,
  amount: number,
  userIdSafe: string,
  paymentTransactionId: string
) {

  requireEntityId(entityId, "registrar pago CxC");

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Monto de pago inválido");
  }

  const receivableId = receivable?.id ?? receivable?.transactionId;

  if (!receivableId) {
    throw new Error("Receivable inválido (id faltante)");
  }

  const ref = doc(db, "entities", entityId, "receivables", receivableId);

  await runTransaction(db, async (tx) => {

    const snap = await tx.get(ref);

    if (!snap.exists()) {
      throw new Error("Receivable no existe");
    }

    const current = snap.data() as Receivable;

    assertNotAnnulled(current);

    const balance = n2(current.balance);

    if (amount > balance) {
      throw new Error("El pago excede el saldo pendiente");
    }

    const collectionIds: string[] =
      Array.isArray(current.collectionTransactionIds)
        ? current.collectionTransactionIds
        : [];

    if (collectionIds.includes(paymentTransactionId)) {
      throw new Error("Este pago ya fue registrado");
    }

    const paid = n2(current.paid + amount);

    const next = computeStatus(paid, current.total);

    tx.update(ref, {
      paid,
      balance: next.balance,
      status: next.status,
      collectionTransactionIds: [...collectionIds, paymentTransactionId],
      lastPaymentAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

  });

  /* CREATE BANK MOVEMENT */

  const journalEntries = await fetchJournalEntriesByTransactionId(
    entityId,
    paymentTransactionId
  );

  const bankLines = journalEntries.filter(
    (e) => n2(e.debit) > 0 && isBankAccount(normAcc(e.account_code))
  );

  for (const line of bankLines) {

    const { account_code, date } = line;

    if (!account_code) throw new Error("Movimiento bancario sin cuenta contable");
    if (!date) throw new Error("Movimiento bancario sin fecha contable");

    await createBankMovement({
      entityId,
      bankAccountId: account_code,
      date,
      amount: n2(line.debit),
      type: "deposit",
      description: line.description ?? "Cobro de cliente",
      relatedJournalTransactionId: paymentTransactionId,
    });
  }
}

/* ============================================================================
ANNUL RECEIVABLE
============================================================================ */

export async function annulReceivableInvoice(
  entityId: string,
  receivableId: string,
  userIdSafe: string,
  reason = "Anulación de factura"
) {

  requireEntityId(entityId, "anular CxC");

  const ref = doc(db, "entities", entityId, "receivables", receivableId);

  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error("Receivable no existe");

  const r = snap.data() as Receivable;

  if ((r.status as any) === "annulled") {
    throw new Error("La factura ya está anulada");
  }

  if (!r.transactionId) {
    throw new Error("Receivable sin transactionId");
  }

  const original = await fetchJournalEntriesByTransactionId(
    entityId,
    r.transactionId
  );

  const today = new Date().toISOString().slice(0, 10);

  const reversalTx =
    doc(collection(db, "entities", entityId, "journalEntries")).id;

  const reversal: JournalEntry[] = original.map((e) => ({
    entityId,
    transactionId: reversalTx,
    date: today as any,
    account_code: e.account_code,
    account_name: e.account_name,
    debit: n2(e.credit),
    credit: n2(e.debit),
    invoice_number: e.invoice_number,
    description: `ANULACIÓN — ${e.description}`,
    source: "manual_journal" as any,
  }));

  await saveJournalEntries(entityId, userIdSafe, reversal);

  await updateDoc(ref, {
    status: "annulled",
    balance: 0,
    updatedAt: serverTimestamp(),
    annulledAt: serverTimestamp(),
    annulledBy: userIdSafe,
    annulmentTransactionId: reversalTx,
    annulmentReason: reason,
  });

}

// -------------------
// REPAIR RECEIVABLE ACCOUNT FROM JOURNAL
// -------------------
export async function repairReceivableAccountFromJournal(
  entityId: string,
  receivableId: string
) {
  requireEntityId(entityId, "reparar cuenta contable");

  const ref = doc(db, "entities", entityId, "receivables", receivableId);

  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Receivable no existe");
  }

  const receivable = snap.data() as Receivable;

  if (!receivable.transactionId) {
    throw new Error("Receivable sin transactionId");
  }

  const journal = await fetchJournalEntriesByTransactionId(
    entityId,
    receivable.transactionId
  );

  const controlLine = journal.find(e => {
    if (!e.account_code) return false;

    const code = e.account_code.trim();

    return isCustomerReceivableAccount(code);
  });

  if (!controlLine) {
    throw new Error(
      "No se encontró línea contable de clientes para reparar"
    );
  }

  const accountCode = controlLine.account_code;

  if (!accountCode) {
    throw new Error("Linea contable sin account_code");
  }

  await updateDoc(ref, {
    account_code: accountCode,
    account_name: controlLine.account_name ?? "Clientes",
    updatedAt: serverTimestamp(),
  });

  return {
    account_code: accountCode,
    account_name: controlLine.account_name ?? "Clientes",
  };
}