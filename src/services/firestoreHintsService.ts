// =======================================================
// Account Hint Service (Contextual, Learning-Based)
// Supplier + Concept → Preferred Account
// =======================================================

import { db } from "../firebase-config";
import {
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { normalizeConcept } from "@/utils/normalizeConcept";

// -------------------------------------------
// 📘 Types
// -------------------------------------------

export interface AccountHint {
  supplierRUC: string;
  supplierName?: string;
  conceptKey: string;
  rawConcept?: string;
  accountCode: string;
  accountName: string;
  updatedAt: number;
}

// -------------------------------------------
// 🔑 LocalStorage key
// -------------------------------------------

const LOCAL_KEY = "accountHintsLocal";

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
  if (!uid || !supplierRUC || !rawConcept || !accountCode) return;

  const concept = normalizeConcept(rawConcept);
  if (!concept) return;

  const docId = `${uid}__${supplierRUC}__${concept}`;

  await setDoc(
    doc(db, "contextualAccountHints", docId),
    {
      uid,
      supplierRUC,
      supplierName,
      concept,
      accountCode,
      accountName,
      frequency: 1,
      createdAt: Date.now(),
    },
    { merge: true }
  );
}

// -------------------------------------------
// 🔍 Get CONTEXTUAL hint (Local → Firestore)
// -------------------------------------------

export async function getContextualAccountHint(
  supplierRUC: string,
  rawConcept?: string
): Promise<AccountHint | null> {
  if (!supplierRUC || !rawConcept) return null;

  const conceptKey = normalizeConcept(rawConcept);
  if (!conceptKey) return null;

  const docId = `${supplierRUC}__${conceptKey}`;

  // 1️⃣ Local cache (fast)
  try {
    const cache = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
    if (cache[docId]) return cache[docId] as AccountHint;
  } catch {
    localStorage.removeItem(LOCAL_KEY);
  }

  // 2️⃣ Firestore fallback
  const snap = await getDoc(doc(db, "accountHints", docId));
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

  return hint;
}

// -------------------------------------------
// 🧹 Clear local cache (debug / reset)
// -------------------------------------------

export function clearLocalHints(): void {
  localStorage.removeItem(LOCAL_KEY);
}