// src/services/receivablesService.ts
import { db } from "@/firebase-config";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import type { Receivable } from "@/types/Receivable";

const colRef = (entityId: string) =>
  collection(db, "entities", entityId, "receivables");

/* ================= FETCH ================= */

export async function fetchReceivables(entityId: string): Promise<Receivable[]> {
  const snap = await getDocs(colRef(entityId));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Receivable) }));
}

/* ================= UPSERT ================= */

export async function upsertReceivable(
  entityId: string,
  input: Partial<Receivable> & {
    transactionId: string;
    invoiceNumber: string;
  }
) {
  const ref = doc(colRef(entityId), input.transactionId);

  const receivable: Receivable = {
    entityId,
    invoiceNumber: input.invoiceNumber,

    customerName: input.customerName,
    customerRUC: input.customerRUC!,

    account_code: input.account_code!,
    account_name: input.account_name!,

    issueDate: input.issueDate!,
    dueDate: input.dueDate,

    termsDays: input.termsDays ?? 30,
    installments: input.installments ?? 1,

    total: input.total!,
    paid: input.paid ?? 0,
    balance: input.balance ?? input.total!,

    status: input.status ?? "pending",
    installmentSchedule: input.installmentSchedule,

    transactionId: input.transactionId,
    createdFrom: input.createdFrom ?? "ai_journal",

    createdAt: serverTimestamp(),
  };

  await setDoc(ref, receivable, { merge: true });
}

/* ================= APPLY COLLECTION ================= */

export async function applyReceivableCollection(
  entityId: string,
  receivable: Receivable,
  amount: number
) {
  const newPaid = Number((receivable.paid + amount).toFixed(2));
  const newBalance = Number((receivable.total - newPaid).toFixed(2));

  const status =
    newBalance === 0 ? "paid" : "partial";

  await updateDoc(
    doc(colRef(entityId), receivable.id!),
    {
      paid: newPaid,
      balance: newBalance,
      status,
      updatedAt: serverTimestamp(),
    }
  );
}