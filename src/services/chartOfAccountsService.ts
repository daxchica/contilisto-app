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
import { assertEntityMember, getUidOrThrow } from "./firestoreSecurity";

const SUBACCOUNTS_COL = "customAccounts";

/* =====================================================
   TYPES
===================================================== */

export type CustomAccountWithId = CustomAccountType & { id: string };

/* =====================================================
   ECUADOR PUC ROOTS
===================================================== */

const ECUADOR_ROOT_CODES = new Set([
  "1", "2", "3", "4", "5",
  "101", "102",
  "201", "202",
  "301", "302", "303",
  "401", "402", "403",
  "501", "502",
]);

export function isEcuadorRootAccount(code: string): boolean {
  return ECUADOR_ROOT_CODES.has(code.trim());
}

/* =====================================================
   HELPERS
===================================================== */

function inferLevel(code: string): number {
  const c = code.trim();

  if (c.length <= 1) return 1;
  if (c.length === 2) return 2;
  if (c.length === 3) return 3;
  if (c.length === 4) return 4;
  return 5;
}

/* =====================================================
   FETCH
===================================================== */

export async function fetchCustomAccounts(
  entityId?: string
): Promise<CustomAccountWithId[]> {
  if (!entityId) return [];

  await assertEntityMember(entityId);

  const colRef = collection(db, "entities", entityId, SUBACCOUNTS_COL);
  const snap = await getDocs(query(colRef, orderBy("code")));

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as CustomAccountType),
  }));
}

/* =====================================================
   CREATE / UPDATE SUBACCOUNT
===================================================== */

export async function createSubaccount(
  entityId: string,
  data: {
    code: string;
    name: string;
    parentCode: string;
    level?: number;
  }
): Promise<void> {

  if (!entityId) throw new Error("entityId missing");

  const uid = getUidOrThrow();
  await assertEntityMember(entityId);

  const code = data.code.trim();
  const name = data.name.trim();
  const parentCode = data.parentCode.trim();

  if (!code) throw new Error("code is required");
  if (!name) throw new Error("name is required");
  if (!parentCode) throw new Error("parentCode is required");

  const account: CustomAccountType = {
    code,
    name,
    parentCode,
    level: data.level ?? inferLevel(code),
    entityId,
    uid,
    createdAt: Date.now(),
  };

  const docRef = doc(db, "entities", entityId, SUBACCOUNTS_COL, code);

  await setDoc(docRef, account, { merge: true });
}

/* =====================================================
   DELETE
===================================================== */

export async function deleteCustomAccount(
  entityId: string,
  code: string
): Promise<void> {

  const c = (code ?? "").trim();
  if (!entityId || !c) throw new Error("Missing arguments");

  await assertEntityMember(entityId);

  const dref = doc(db, "entities", entityId, SUBACCOUNTS_COL, c);
  await deleteDoc(dref);
}