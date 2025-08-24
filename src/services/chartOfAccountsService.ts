// src/services/chartOfAccountsService.ts
import { 
  addDoc,
  collection,
  deleteDoc, 
  doc, 
  getDocs,
  orderBy, 
  query, 
  setDoc,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../firebase-config";
import type { CustomAccount } from "../types/AccountTypes";

const SUBACCOUNTS_COL = "customChart";

export type CustomAccountWithId = CustomAccount & { id: string };

export type CustomAccount = { id?: string; code: string; name: string; entityId: string };

export async function fetchCustomAccounts(entityId?: string): Promise<CustomAccount[]> {
  if (!entityId) return []; // <-- guard
  const colRef = collection(db, "entities", entityId, SUBACCOUNTS_COL);
  const snap = await getDocs(query(colRef, orderBy("code")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as CustomAccount) }));
}

export async function createSubaccount(
  entityId: string, 
  data: Pick<CustomAccount, "code" | "name" | "parentCode"> & { 
    userId?: string;
  }
): Promise<void> {
  if (!entityId) throw new Error("createSubaccount: entityId missing");
  const { code, name, parentCode, userId } = data;
  const row: CustomAccount = {
    code,
    name,
    parentCode,
    entityId,
    userId,
    createdAt: Date.now(), // or serverTimestamp() if you store as Firestore Timestamp in the type
  };

  // Use code as doc id for idempotency and easy deletion by code
  const docRef = doc(db, "entities", entityId, SUBACCOUNTS_COL, code);
  await setDoc(docRef, { ...row, createdAt: serverTimestamp() });
}

export async function deleteCustomAccount(entityId: string, code: string): Promise<void> {
  if (!entityId || !code) throw new Error("deleteCustomAccount: missing args");
  const dref = doc(db, "entities", entityId, SUBACCOUNTS_COL, code);
  return deleteDoc(dref);
}