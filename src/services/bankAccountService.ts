// src/services/bankAccountService.ts
import { db } from "../firebase-config";
import { collection, addDoc, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { BankAccount } from "../types/BankTypes";

export async function fetchBankAccounts(userId: string): Promise<BankAccount[]> {
  const ref = collection(db, "bankAccounts");
  const q = query(ref, where("createdBy", "==", userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as BankAccount));
}

export async function createBankAccount(account: BankAccount): Promise<void> {
  const ref = collection(db, "bankAccounts");
  await addDoc(ref, account);
}

export async function deleteBankAccount(id: string): Promise<void> {
  const ref = doc(db, "bankAccounts", id);
  await deleteDoc(ref);
}


