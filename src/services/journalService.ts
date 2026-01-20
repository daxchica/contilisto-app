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
import { createBankMovement, linkJournalTransaction } from "./bankMovementService";

/* ================= HELPERS ================= */

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

function isSupplierPayableAccount(code?: string) {
  const c = norm(code);
  return c.startsWith("20101") || c.startsWith("211");
}

function duplicateKey(e: JournalEntry) {
  return `${e.invoice_number}::${e.account_code}::${e.debit}::${e.credit}::${e.date}`;
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

/* ================= FETCH ================= */

export async function fetchJournalEntries(entityId: string): Promise<JournalEntry[]> {
  const col = collection(db, "entities", entityId, "journalEntries");
  const snap = await getDocs(col);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as JournalEntry) }));
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

/* ================= SAVE ================= */

export async function saveJournalEntries(
  entityId: string,
  entries: JournalEntry[],
  userId: string
): Promise<JournalEntry[]> {
  const col = collection(db, "entities", entityId, "journalEntries");

  const existing: Record<string, boolean> = {};
  const saved: JournalEntry[] = [];
  const batch = writeBatch(db);

  for (const e of entries) {
    const ref = doc(col);
    const id = e.id ?? ref.id;
    const transactionId = e.transactionId ?? ref.id;

    const entry: JournalEntry = {
      ...e,
      id,
      entityId,
      uid: userId,
      userId,
      transactionId,
      invoice_number: resolveInvoiceNumber({ ...e, transactionId }),
      description: resolveDescription(e),
      createdAt: typeof e.createdAt ===  "number" ? e.createdAt : Date.now(),
    };

    const key = duplicateKey(entry);
    if (existing[key]) continue;

    batch.set(doc(col, id), stripUndefined(entry) as any);
    saved.push(entry);
    existing[key] = true;
  }

  if (saved.length) await batch.commit();

  // -------- PAYABLE SYNC --------
  const payableLines = saved.filter(
    e => isSupplierPayableAccount(e.account_code) && Number(e.credit) > 0
  );

  const grouped = new Map<string, JournalEntry[]>();
  for (const e of payableLines) {
    const k = e.transactionId!;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(e);
  }

  for (const [tx, lines] of grouped) {
    const total = Number(
      lines.reduce((s, e) => s + Number(e.credit), 0).toFixed(2)
    );

    const ref = lines[0];
    await upsertPayable(entityId, {
      transactionId: tx,
      invoiceNumber: ref.invoice_number!,
      issueDate: ref.date,
      supplierName: ref.supplier_name || "Proveedor",
      supplierRUC: ref.issuerRUC || "",
      account_code: ref.account_code,
      account_name: ref.account_name,
      total,
      paid: 0,
      termsDays: 30,
      installments: 1,
      createdFrom: "ai_journal",
    });
  }

  return saved;
}

/* ================= DELETE ================= */

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

/* ================= PAYABLE PAYMENT ================= */

export async function createPayablePaymentJournalEntry(
  entityId: string,
  payable: Payable,
  amount: number,
  paymentDate: string,
  bankAccount: { id: string; account_code: string; name?: string },
  userId: string,
  options?: { bankMovementId?: string; }
) {
  if (!entityId) throw new Error("entityId faltante");
  if (!userId) throw new Error("userId faltante");
  if (!payable?.id) throw new Error("Payable inválido");
  if (!payable.account_code) {
    throw new Error(
      "El payable no tiene cuenta contable de proveedores. Debe repararse antes de pagar."
    );
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Monto inválido");
  }

  if (amount > payable.balance) {
    throw new Error("El monto excede el saldo pendiente");
  }

  if (!bankAccount?.id || !bankAccount.account_code) {
    throw new Error("Cuenta bancaria requerida");
  }

  const tx =
    options?.bankMovementId ??
    doc(collection(db, "entities", entityId, "journalEntries")).id;

  const description =
  `Pago a proveedor ${payable.supplierName} — Factura ${payable.invoiceNumber}`;  

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
    amount: -amount,
    type: "out",
    description: `Pago a proveedor ${payable.supplierName ?? "Proveedor"} - Factura ${payable.invoiceNumber}`,
  });

  await linkJournalTransaction(entityId, bankMovementId, tx);

  await applyPayablePayment(entityId, payable, amount);

  return tx;
}