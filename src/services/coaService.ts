//src/services/coaservice.ts

import { db } from "@/firebase-config";
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp,
  DocumentReference,
} from "firebase/firestore";
import ECUADOR_COA from "@/../shared/coa/ecuador_coa";
import type { Account } from "@/types/AccountTypes";
import { requireEntityId } from "./requireEntityId";

export async function initializeEntityCOA(entityId: string) {
  
  const accountsRef = collection(db, "entities", entityId, "accounts");
  const snap = await getDocs(accountsRef);

  if (!snap.empty) return;

  const batch = writeBatch(db);

  ECUADOR_COA.forEach((acc) => {
    const newRef = doc(accountsRef, acc.code);

    batch.set(newRef, {
      code: acc.code,
      name: acc.name,
      parentCode: acc.parentCode || null,
      level: acc.code.length ?? acc.code.length,
      isSystem: true,
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

export async function migrateBankAccountsToCOA(entityId: string) {
  requireEntityId(entityId, "migrar cuentas bancarias");
  const bankRef = collection(db, "entities", entityId, "bankAccounts");
  const coaRef = collection(db, "entities", entityId, "accounts");

  const snap = await getDocs(bankRef);
  if (snap.empty) return;

  const batch = writeBatch(db);

  for (const bankDoc of snap.docs) {
    const data = bankDoc.data();

    const accountCode = data.name; // already "101010301"
    const bankName = data.number;  // "Banco Guayaquil"

    if (!accountCode || !bankName) continue;

    const q = query(coaRef, where("code", "==", accountCode));
    const exists = await getDocs(q);

    if (exists.empty) {
      const newRef = doc(coaRef);
      batch.set(newRef, {
        code: accountCode,
        name: bankName,
        parentCode: "1010103",
        level: accountCode.length,
        isSystem: false,
        createdAt: serverTimestamp(),
      });
    }

    // delete old bankAccount document
    batch.delete(bankDoc.ref);
  }

  await batch.commit();
}

/**
 * Creates a new subaccount under a parent account
 * Example parent: 1010103
 */
export async function createSubAccountUnderParent(
  entityId: string,
  parentCode: string,
  name: string
): Promise<string> {
  requireEntityId(entityId, "crear subcuentas");
  const accountsRef = collection(db, "entities", entityId, "accounts");

  const q = query(accountsRef, where("parentCode", "==", parentCode));
  const snap = await getDocs(q);

  const existingCodes = snap.docs.map(d => d.data().code);

  let counter = 1;
  let newCode = "";

  do {
    const suffix = String(counter).padStart(2, "0");
    newCode = parentCode + suffix;
    counter++;
  } while (existingCodes.includes(newCode));

  await setDoc(
    doc(accountsRef, newCode), 
    {
      code: newCode,
      name,
      parentCode,
      level: newCode.length,
      isSystem: false,
      
      isBank: parentCode === "1010103",
      
      createdAt: serverTimestamp(),
  }, { merge: false });

  return newCode;
}

export async function fetchBankAccountsFromCOA(
    entityId: string
): Promise<Account[]> {

  requireEntityId(entityId, "cargar cuentas bancarias");

  const accountsRef = collection(db, "entities", entityId, "accounts");

  const q = query(
    accountsRef,
    where("parentCode", "==", "1010103")
  );

  const snap = await getDocs (q);
  
  const banks: Account[] = snap.docs.map((docSnap) => {
    const data = docSnap.data() as any;
 
      return {
        id: docSnap.id,
        entityId,
        account_code: String(data.code ?? ""),
        code: String(data.code ?? ""),
        parentCode: String(data.parentCode ?? ""),
        name: String(data.name ?? ""),
        currency: "USD",
        createdBy: "",
        number: String(data.code ?? ""),
        bankName: String(data.name ?? ""),
        level: Number(data.level ?? 0),
        isSystem: Boolean(data.isSystem ?? false),
        isBank: true,
      };
  });

  banks.sort((a, b) => a.code.localeCompare(b.code));

  return banks;
}

/**
 * Additive migration: adds any ECUADOR_COA accounts missing from an entity's
 * Firestore accounts collection. Safe to run on existing entities — never
 * overwrites or deletes existing accounts.
 */
export async function syncEntityCOA(entityId: string): Promise<number> {
  requireEntityId(entityId, "sincronizar plan de cuentas");

  const accountsRef = collection(db, "entities", entityId, "accounts");
  const snap = await getDocs(accountsRef);

  const existingCodes = new Set(snap.docs.map((d) => d.data().code as string));

  const missing = ECUADOR_COA.filter((acc) => !existingCodes.has(acc.code));
  if (missing.length === 0) return 0;

  const BATCH_LIMIT = 490;
  let added = 0;

  for (let i = 0; i < missing.length; i += BATCH_LIMIT) {
    const chunk = missing.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);

    chunk.forEach((acc) => {
      const ref = doc(accountsRef, acc.code);
      batch.set(ref, {
        code: acc.code,
        name: acc.name,
        parentCode: acc.parentCode ?? null,
        level: acc.level,
        isSystem: true,
        nature: acc.nature ?? null,
        taxType: acc.taxType ?? null,
        category: acc.category ?? null,
        sign: acc.sign ?? null,
        isReceivable: acc.isReceivable ?? false,
        isPayable: acc.isPayable ?? false,
        requiresThirdParty: acc.requiresThirdParty ?? false,
        isBank: acc.isBank ?? false,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
    added += chunk.length;
  }

  return added;
}

export async function deleteCOAAccount(
    entityId: string, 
    accountCode: string
) {
    requireEntityId(entityId, "eliminar cuenta");

    if (!accountCode.startsWith("1010103")) {
    throw new Error("Solo se pueden eliminar cuentas bancarias");
  }
  
    const accountsRef = collection(db, "entities", entityId, "accounts");
    const q = query(accountsRef, where("code", "==", accountCode));
    const snap = await getDocs(q);

    if (snap.empty) return;

    const batch = writeBatch(db);

    snap.docs.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });

  await batch.commit();
}
