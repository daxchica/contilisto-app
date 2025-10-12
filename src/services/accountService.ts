// src/services/accountService.ts
import { Account } from "../types/AccountTypes";
import { getFirestore, collection, getDocs } from "firebase/firestore";

export async function fetchAccounts(entityId: string): Promise<Account[]> {
  const db = getFirestore();
  const snapshot = await getDocs(collection(db, "entities", entityId, "accounts"));
  return snapshot.docs.map((doc) => ({ ...(doc.data() as Account), id: doc.id }));
}