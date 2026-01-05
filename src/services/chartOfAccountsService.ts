// src/services/chartOfAccountsService.ts
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";

import { db } from "../firebase-config";
import type { CustomAccount as CustomAccountType } from "../types/AccountTypes";

const SUBACCOUNTS_COL = "customChart";

// What the UI usually wants (doc id included)
export type CustomAccountWithId = CustomAccountType & { id: string };

/**
 * Infer level from code if caller doesn't provide it.
 * Adjust this if your system uses a different level convention.
 */
function inferLevel(code: string): number {
  const c = code.trim();

  // Simple & predictable:
  // 1 digit => level 1, 2 digits => level 2, 3 => 3, 4 => 4, 6+ => 5
  if (c.length <= 1) return 1;
  if (c.length === 2) return 2;
  if (c.length === 3) return 3;
  if (c.length === 4) return 4;
  return 5;
}

export async function fetchCustomAccounts(
  entityId?: string
): Promise<CustomAccountWithId[]> {
  if (!entityId) return [];

  const colRef = collection(db, "entities", entityId, SUBACCOUNTS_COL);
  const snap = await getDocs(query(colRef, orderBy("code")));

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as CustomAccountType),
  }));
}

export async function createSubaccount(
  entityId: string,
  data: {
    code: string; 
    name: string;
    parentCode: string;
    userId?: string;
    level?: number; // allow caller to override; we'll infer if missing
  }
): Promise<void> {
  if (!entityId) throw new Error("createSubaccount: entityId missing");

  const code = data.code.trim();
  const name = data.name.trim();
  const parentCode = data.parentCode.trim();

  if (!code) throw new Error("createSubaccount: code is required");
  if (!name) throw new Error("createSubaccount: name is required");
  if (!parentCode) throw new Error("createSubaccount: parentCode is required");

  const now = Date.now();

  const account: CustomAccountType = {
    code,
    name,
    parentCode,
    level: data.level ?? inferLevel(code),
    entityId,
    userId: data.userId,
    createdAt: now,
  };

  // Use code as doc id for idempotency and easy deletion by code
  const docRef = doc(db, "entities", entityId, SUBACCOUNTS_COL, code);

  // merge=true so re-creating the same code updates safely
  await setDoc(docRef, account, { merge: true });
}

export async function deleteCustomAccount(entityId: string, code: string): Promise<void> {
  const c = (code ?? "").trim();
  if (!entityId || !c) throw new Error("deleteCustomAccount: missing args");

  const dref = doc(db, "entities", entityId, SUBACCOUNTS_COL, c);
  await deleteDoc(dref);
}