// =======================================================
// Account Hint Service (Contextual, Learning-Based)
// Supplier + Concept → Preferred Expense Account
// =======================================================

import { db } from "../firebase-config";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { normalizeConcept } from "@/utils/normalizeConcept";

// -------------------------------------------
// 📘 Types
// -------------------------------------------

export interface AccountHint {
  uid: string;
  supplierRUC: string;
  supplierName?: string;
  concept: string;
  accountCode: string;
  accountName: string;
  frequency: number;
  createdAt: number;
  updatedAt: number;
}

// -------------------------------------------
// 🔑 LocalStorage key
// -------------------------------------------

const LOCAL_KEY = "contextualAccountHintsLocal";

// -------------------------------------------
// 🧠 Save CONTEXTUAL hint (Supplier + Concept)
// -------------------------------------------

export async function saveContextualAccountHint(
  uid: string,
  supplierRUC: string,
  supplierName: string | undefined,
  rawConcept: string | undefined,
  accountCode: string,
  accountName: string
): Promise<void> {
  if (!uid || !supplierRUC || !rawConcept) return;
  if (!accountCode || !accountName) return;

  // ❌ NEVER learn IVA / Proveedores / non-expense
  if (
    accountCode.startsWith("133") || // IVA crédito
    accountCode.startsWith("213") || // IVA débito
    accountCode.startsWith("201") || // Proveedores
    accountCode.startsWith("211")    // CxP varias
  ) {
    return;
  }

  // ❌ Only expense accounts (group 5)
  if (!accountCode.startsWith("5")) return;

  const concept = normalizeConcept(rawConcept);
  if (!concept || concept.length < 3) return;

  const docId = `${uid}__${supplierRUC}__${concept}`;
  const ref = doc(db, "contextualAccountHints", docId);
  const snap = await getDoc(ref);

  // -------------------------------------------
  // First time → create
  // -------------------------------------------
  if (!snap.exists()) {
    await setDoc(ref, {
      uid,
      supplierRUC,
      supplierName: supplierName || "",
      concept,
      accountCode,
      accountName,
      frequency: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return;
  }

  const data = snap.data() as AccountHint;

  // -------------------------------------------
  // Same account → reinforce
  // -------------------------------------------
  if (data.accountCode === accountCode) {
    await updateDoc(ref, {
      frequency: (data.frequency || 1) + 1,
      updatedAt: Date.now(),
    });
    return;
  }

  // -------------------------------------------
  // Different account → conservative overwrite
  // Only if confidence is still low
  // -------------------------------------------
  if ((data.frequency || 1) < 3) {
    await updateDoc(ref, {
      accountCode,
      accountName,
      frequency: (data.frequency || 1) + 1,
      updatedAt: Date.now(),
    });
  }
}

// -------------------------------------------
// 🔍 Get CONTEXTUAL hint (Local → Firestore)
// -------------------------------------------

export async function getContextualAccountHint(
  supplierRUC: string,
  rawConcept?: string
): Promise<{ accountCode: string; accountName: string } | null> {
  if (!supplierRUC || !rawConcept) return null;

  const concept = normalizeConcept(rawConcept);
  if (!concept) return null;

  const uid = localStorage.getItem("uid"); // already present in your app
  if (!uid) return null;

  const docId = `${uid}__${supplierRUC}__${concept}`;

  // 1️⃣ Local cache
  try {
    const cache = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
    if (cache[docId]) {
      return {
        accountCode: cache[docId].accountCode,
        accountName: cache[docId].accountName,
      };
    }
  } catch {
    localStorage.removeItem(LOCAL_KEY);
  }

  // 2️⃣ Firestore
  const snap = await getDoc(doc(db, "contextualAccountHints", docId));
  if (!snap.exists()) return null;

  const hint = snap.data() as AccountHint;

  // Cache it
  try {
    const cache = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
    cache[docId] = hint;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(cache));
  } catch {
    /* noop */
  }

  return {
    accountCode: hint.accountCode,
    accountName: hint.accountName,
  };
}

// -------------------------------------------
// 🧹 Clear local cache (debug / reset)
// -------------------------------------------

export function clearLocalHints(): void {
  localStorage.removeItem(LOCAL_KEY);
}