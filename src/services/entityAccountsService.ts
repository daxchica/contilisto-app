// src/services/entityAccountsService.ts
import { db } from "@/firebase-config";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  orderBy,
  query,
  where,
  serverTimestamp
} from "firebase/firestore";
import type { Account } from "@/types/AccountTypes";
import { requireEntityId } from "@/services/requireEntityId";
import { assertEntityMember } from "@/services/firestoreSecurity";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function inferLevel(code: string): number {
  // Your COA levels are not always length-based; keep it simple and stable:
  if (code.length <= 1) return 1;
  if (code.length === 2) return 2;
  if (code.length === 3) return 3;
  if (code.length === 4) return 4;
  return 5;
}

function toAccount(data: any): Account {
  const code = String(data.code ?? "").trim();
  const name = String(data.name ?? "").trim();

  if (!code) throw new Error("Account missing code");
  if (!name) throw new Error(`Account ${code} missing name`);

  return {
    code,
    name,
    parentCode: data.parentCode ?? null,
    level: Number(data.level ?? inferLevel(code)),
    isReceivable: Boolean(data.isReceivable ?? false),
    isPayable: Boolean(data.isPayable ?? false),
  };
}

/* -------------------------------------------------------------------------- */
/* Fetch                                                                       */
/* -------------------------------------------------------------------------- */

export async function fetchEntityAccounts(
    entityId: string
): Promise<Account[]> {
  requireEntityId(entityId, "cargar plan de cuentas");
  await assertEntityMember(entityId);

  const ref = collection(db, "entities", entityId, "accounts");
  const snap = await getDocs(query(ref, orderBy("code")));

  return snap.docs
    .map(d => toAccount(d.data()))
    .sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true }));
}

/* -------------------------------------------------------------------------- */
/* Create Subaccount                                                           */
/* -------------------------------------------------------------------------- */

export async function createSubAccount(
  entityId: string,
  account: Account
) {
  requireEntityId(entityId, "crear subcuenta");
  await assertEntityMember(entityId);

  const ref = doc(db, "entities", entityId, "accounts", account.code);

  await setDoc(ref, {
    ...account,
    isSystem: false,
    createdAt: serverTimestamp(),
  });
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                      */
/* -------------------------------------------------------------------------- */

export async function deleteAccount(
  entityId: string,
  code: string
) {
  requireEntityId(entityId, "eliminar cuenta");
  await assertEntityMember(entityId);

  const ref = doc(db, "entities", entityId, "accounts", code);
  await deleteDoc(ref);
}