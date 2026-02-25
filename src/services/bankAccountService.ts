import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase-config";
import type { BankAccount } from "../types/bankTypes";
import { assertEntityMember, getUidOrThrow } from "./firestoreSecurity";

/* =====================================================
   BANK ACCOUNTS
===================================================== */

const bankRef = (entityId: string) =>
  collection(db, "entities", entityId, "bankAccounts");

/* ---------------- FETCH ---------------- */

export async function fetchBankAccounts(
  entityId: string
): Promise<BankAccount[]> {
  if (!entityId) return [];

  await assertEntityMember(entityId);

  const snap = await getDocs(bankRef(entityId));

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<BankAccount, "id">),
  }));
}

/* ---------------- GET ONE ---------------- */

export async function getBankAccount(
  entityId: string,
  accountId: string
): Promise<BankAccount | null> {
  await assertEntityMember(entityId);

  const ref = doc(db, "entities", entityId, "bankAccounts", accountId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...(snap.data() as Omit<BankAccount, "id">),
  };
}

/* ---------------- CREATE ---------------- */

export async function createBankAccount(data: {
  entityId: string;
  name: string;
  number?: string;
  currency?: string;
  bankName?: string;
}): Promise<string> {
  const uid = getUidOrThrow();

  const {
    entityId,
    name,
    number = "",
    currency = "USD",
    bankName = "",
  } = data;

  await assertEntityMember(entityId);

  const ref = await addDoc(bankRef(entityId), {
    name: name.trim(),
    number: number.trim(),
    currency,
    bankName: bankName.trim(),
    entityId,
    uid,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

/* ---------------- CREATE WITH NUMBER AS ID ---------------- */

export async function createBankAccountByNumber(data: {
  entityId: string;
  number: string;
  name: string;
  currency?: string;
  bankName?: string;
}): Promise<void> {
  const uid = getUidOrThrow();

  const {
    entityId,
    number,
    name,
    currency = "USD",
    bankName = "",
  } = data;

  const docId = number.trim();
  if (!docId) throw new Error("Account number is required");

  await assertEntityMember(entityId);

  const ref = doc(db, "entities", entityId, "bankAccounts", docId);
  const exists = await getDoc(ref);

  if (exists.exists()) {
    throw new Error("A bank account with this number already exists");
  }

  await setDoc(ref, {
    name: name.trim(),
    number: docId,
    currency,
    bankName: bankName.trim(),
    entityId,
    uid,
    createdAt: serverTimestamp(),
  });
}

/* ---------------- UPDATE ---------------- */

export async function updateBankAccount(
  entityId: string,
  accountId: string,
  patch: Partial<Pick<BankAccount, "name" | "number" | "currency" | "bankName">>
) {
  await assertEntityMember(entityId);

  const safe: any = {};
  if (patch.name) safe.name = patch.name.trim();
  if (patch.number) safe.number = patch.number.trim();
  if (patch.currency) safe.currency = patch.currency;
  if (patch.bankName) safe.bankName = patch.bankName.trim();

  const ref = doc(db, "entities", entityId, "bankAccounts", accountId);
  await updateDoc(ref, safe);
}

/* ---------------- DELETE ---------------- */

export async function deleteBankAccount(
  entityId: string,
  accountId: string
) {
  await assertEntityMember(entityId);

  await deleteDoc(doc(db, "entities", entityId, "bankAccounts", accountId));
}