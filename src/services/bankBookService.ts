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
import { BankBookEntry } from "../types/BankTypes";

export async function fetchBankBookEntries(
  entityId: string, 
  bankAccountId: string
): Promise<BankBookEntry[]> {
  const ref = collection(db, "entities", entityId, "bankBookEntries");
  const q = query(ref, where("bankAccountId", "==", bankAccountId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<BankBookEntry, "id">)})
  );
}

export async function createBankBookEntry(
  entityId: string, 
  entry: BankBookEntry,
  userId: string
): Promise<void> {
  const ref = collection(db, "entities", entityId, "bankBookEntries");
  await addDoc(ref, {
    ...entry,
    userId,
    createdBy: userId,
    createdAt: Timestamp.now(),
});
}