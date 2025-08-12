// src/services/bankAccountService.ts
import { db } from "../firebase-config";
import { addDoc, collection, deleteDoc, doc, getDocs, query, where, Timestamp
} from "firebase/firestore";
import { BankAccount } from "../types/BankTypes";

export async function fetchBankAccounts(
  userId: string,
  entityId: string
): Promise<BankAccount[]> {
  try {
    const colRef = collection(db, "entities", entityId, "bankAccounts");
    const q = query(colRef, where("userId", "==", userId));
    const snap = await getDocs(q);

    return snap.docs.map( d => {
      const data = d.data() as Omit<BankAccount, "id">;
      return { id: d.id, ...data };
    });
  } catch (e) {
    console.error("fetchBankAccounts error:", e);
    return [];
    }
  }

export async function createBankAccount(account: BankAccount): Promise<void> {
  if(!account?.entityId) throw new Error("entityId is required");

  const colRef = collection(db, "entities", account.entityId, "bankAccounts");
  await addDoc(colRef, { 
    name: account.name,
    number: account.number ?? "",
    currency: account.currency ?? "USD",
    bankName: account.bankName ?? "",
    entityId: account.entityId,
    userId: account.userId ?? account.createdBy,
    createdBy: account.createdBy,
    createdAt: Timestamp.now(),
  });
}

export async function deleteBankAccount(
  entityId: string, 
  bankId: string
): Promise<void> {
  const ref = doc(db, "entities", entityId, "bankAccounts", bankId);
  await deleteDoc(ref);
}

