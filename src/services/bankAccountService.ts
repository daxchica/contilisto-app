// src/services/bankAccountService.ts
import { getAuth } from "firebase/auth";
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
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase-config";
import { BankAccount } from "../types/BankTypes";
import type { CustomAccount } from "../types/AccountTypes";

const colRef = (entityId: string) =>
  collection(db, "entities", entityId, "chart_of_accounts");

/** Fetch user-defined accounts for an entity */
export async function fetchCustomAccounts(entityId: string): Promise<CustomAccount[]> {
  const q = query(colRef(entityId), orderBy("code"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as CustomAccount);
}

/** Create/overwrite a subaccount with the provided code (document id = code) */
export async function createSubaccount(entityId: string, row: Omit<CustomAccount, "entityId">) {
  const uid = auth.currentUser?.uid ?? "";
  const payload: CustomAccount = {
    ...row,
    entityId,
    userId: uid || undefined,
    createdAt: Date.now(),
  };
  await setDoc(doc(colRef(entityId), payload.code), payload);
}

/** Optional: allow deleting a custom subaccount */
export async function deleteCustomAccount(entityId: string, code: string) {
  await deleteDoc(doc(colRef(entityId), code));
}

/* ----------------------------- helpers ----------------------------- */

function uidOrThrow(): string {
  const uid = getAuth().currentUser?.uid ?? "";
  if (!uid) {
    const err: any = new Error("User is not signed in");
    err.code = "unauthenticated";
    throw err;
  }
  return uid;
}

/** Translate Firestore SDK errors to stable codes we can branch on in the UI */
function mapFirestoreError(e: any): never {
  const code = e?.code || e?.message || "unknown";
  const err: any = new Error(
    code === "permission-denied"
      ? "Missing or insufficient permissions"
      : code === "not-found"
      ? "Document not found"
      : typeof e?.message === "string"
      ? e.message
      : "Unexpected Firestore error"
  );
  err.code =
    code === "permission-denied" ||
    code === "failed-precondition" ||
    code === "unauthenticated" ||
    code === "not-found"
      ? code
      : "unknown";
  throw err;
}

/** Optional: confirms the current user owns the entity */
async function assertEntityOwnership(entityId: string): Promise<void> {
  const uid = uidOrThrow();
  try {
    const entityRef = doc(db, "entities", entityId);
    const snap = await getDoc(entityRef); // allowed only for owner by your rules
    if (!snap.exists()) {
      const err: any = new Error("Entity not found");
      err.code = "entity-not-found";
      throw err;
    }
    const ownerUid = (snap.data() as any)?.uid;
    if (ownerUid !== uid) {
      const err: any = new Error("Entity belongs to a different user");
      err.code = "permission-denied";
      throw err;
    }
  } catch (e) {
    mapFirestoreError(e);
  }
}

/* ----------------------------- queries ----------------------------- */

/**
 * List all bank accounts for an entity.
 * Your security rules already ensure only the entity owner can read.
 */
export async function fetchBankAccounts(
  _userId: string | null, 
  entityId: string
): Promise<BankAccount[]> {
  if (!entityId) return [];

  const uid = getAuth().currentUser?.uid ?? "";
  if (!uid) throw new Error("Not signed in");

  try {
    const colRef = collection(db, "entities", entityId, "bankAccounts");

    const q = query(colRef, where("userId", "==", uid));
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BankAccount, "id">) }));
  } catch (e: any) {
    console.error("[fetchBankAccounts] FAILED:", e?.code, e?.message);
    throw e;
  }
}

/** Read a single bank account by id */
export async function getBankAccount(
  entityId: string,
  accountId: string
): Promise<BankAccount | null> {
  try {
    await assertEntityOwnership(entityId);
    const ref = doc(db, "entities", entityId, "bankAccounts", accountId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<BankAccount, "id">) };
  } catch (e) {
    mapFirestoreError(e);
  }
}

/* ----------------------------- mutations ----------------------------- */

/** Create account with auto-generated document ID. Returns the created id. */
export async function createBankAccount(data: {
  entityId: string;
  name: string;
  number?: string;
  currency?: string;
  bankName?: string;
  userId: string; // your rules check this
  createdBy?: string; // defaults to userId
}): Promise<string> {
  const {
    entityId,
    name,
    number = "",
    currency = "USD",
    bankName = "",
    userId,
    createdBy = userId,
  } = data;

  try {
    await assertEntityOwnership(entityId);
    const colRef = collection(db, "entities", entityId, "bankAccounts");
    const ref = await addDoc(colRef, {
      name: name.trim(),
      number: number.trim(),
      currency,
      bankName: bankName.trim(),
      entityId,
      userId,
      createdBy,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (e) {
    mapFirestoreError(e);
  }
}

/** Create account using the account number as the document ID (guarantees uniqueness) */
export async function createBankAccountByNumber(data: {
  entityId: string;
  number: string; // will be the doc ID
  name: string;
  currency?: string;
  bankName?: string;
  userId: string;
  createdBy?: string;
}): Promise<void> {
  const {
    entityId,
    number,
    name,
    currency = "USD",
    bankName = "",
    userId,
    createdBy = userId,
  } = data;

  const docId = number.trim();
  if (!docId) {
    const err: any = new Error("Account number is required");
    err.code = "invalid-argument";
    throw err;
  }

  try {
    await assertEntityOwnership(entityId);
    const ref = doc(db, "entities", entityId, "bankAccounts", docId);

    const exists = await getDoc(ref);
    if (exists.exists()) {
      const err: any = new Error("A bank account with this number already exists");
      err.code = "account/exists";
      throw err;
    }

    await setDoc(ref, {
      id: docId, // keep id in the document for convenience
      name: name.trim(),
      number: docId,
      currency,
      bankName: bankName.trim(),
      entityId,
      userId,
      createdBy,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    mapFirestoreError(e);
  }
}

/** Update a bank account (safe fields only) */
export async function updateBankAccount(
  entityId: string,
  accountId: string,
  patch: Partial<Pick<BankAccount, "name" | "number" | "currency" | "bankName">>
): Promise<void> {
  const safe: any = {};
  if (typeof patch.name === "string") safe.name = patch.name.trim();
  if (typeof patch.number === "string") safe.number = patch.number.trim();
  if (typeof patch.currency === "string") safe.currency = patch.currency;
  if (typeof patch.bankName === "string") safe.bankName = patch.bankName.trim();

  try {
    await assertEntityOwnership(entityId);
    const ref = doc(db, "entities", entityId, "bankAccounts", accountId);
    await updateDoc(ref, safe);
  } catch (e) {
    mapFirestoreError(e);
  }
}

/** Delete by document ID */
export async function deleteBankAccount(
  entityId: string,
  accountId: string
): Promise<void> {
  try {
    await assertEntityOwnership(entityId);
    await deleteDoc(doc(db, "entities", entityId, "bankAccounts", accountId));
  } catch (e) {
    mapFirestoreError(e);
  }
}

/** Backwards-compat wrapper for legacy call sites */
export async function deleteBankAccountWithUserId(
  _userId: string,
  entityId: string,
  accountId: string
): Promise<void> {
  return deleteBankAccount(entityId, accountId);
}