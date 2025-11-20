// src/services/bankBookService.ts

import { db } from "../firebase-config";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

import type { BankBookEntry } from "../types/bankTypes";

/* ============================================================
 *  FETCH BANK BOOK ENTRIES
 * ============================================================ */
export async function fetchBankBookEntries(
  entityId: string,
  bankAccountId: string
): Promise<BankBookEntry[]> {
  if (!entityId || !bankAccountId) return [];

  const ref = collection(db, "entities", entityId, "bankBookEntries");
  const q = query(ref, where("bankAccountId", "==", bankAccountId));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as Omit<BankBookEntry, "id">;

    return {
      id: d.id,
      ...data,
      date:
        data.date ||
        new Date().toISOString().split("T")[0], // normaliza fecha
    };
  });
}

/* ============================================================
 *  CREATE BANK BOOK ENTRY
 * ============================================================ */
export async function createBankBookEntry(
  entityId: string,
  entry: BankBookEntry,
  userId: string
): Promise<void> {
  if (!entityId) throw new Error("entityId es requerido");
  if (!entry) throw new Error("entry es requerido");

  const ref = collection(db, "entities", entityId, "bankBookEntries");

  await addDoc(ref, {
    ...entry,
    createdBy: userId,
    userId,
    createdAt: Timestamp.now(),
  });
}