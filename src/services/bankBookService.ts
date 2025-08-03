// src/services/bankBookService.ts
import { db } from "../firebase-config";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { BankBookEntry } from "../types/BankTypes";

export async function fetchBankBookEntries(entityId: string, bankAccountId: string): Promise<BankBookEntry[]> {
  const ref = collection(db, `entities/${entityId}/bankBookEntries`);
  const q = query(ref, where("bankAccountId", "==", bankAccountId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as BankBookEntry));
}

export async function createBankBookEntry(entityId: string, entry: BankBookEntry): Promise<void> {
  const ref = collection(db, `entites/${entityId}/bankBookEntries`);
  await addDoc(ref, entry);
}