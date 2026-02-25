// =====================================================================
// src/services/firestoreHintsService.ts
// CONTILISTO — FINAL PRODUCTION VERSION (PERMISSION SAFE) (ENTITY-ONLY)
// =====================================================================

import { db, auth } from "../firebase-config";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  type UpdateData,
  type DocumentData,
} from "firebase/firestore";

// -------------------------------------------
// TYPES
// -------------------------------------------
export interface AccountHint {
  entityId: string;
  uid: string;
  supplierRUC: string;
  supplierName: string;
  accountCode: string;
  accountName: string;
  concept?: string;
  frequency: number;
  createdAt: number;
  updatedAt: number;
}

// -------------------------------------------
// LOCAL CACHE
// -------------------------------------------
const LOCAL_KEY = "contextualAccountHintsLocal";
const MIN_HINT_FREQUENCY = 2;

function updateLocalCache(cacheKey: string, hint: AccountHint) {
  try {
    const cache = JSON.parse( localStorage.getItem(LOCAL_KEY) || "{}" );
    cache[cacheKey] = hint;
    localStorage.setItem( LOCAL_KEY, JSON.stringify(cache));
  }
  catch {
    localStorage.removeItem(LOCAL_KEY);
  }
}

function buildConceptKey(concept?: string) {
  return (concept ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function buildDocId(supplierRUC: string, concept?: string) {
  const conceptKey = buildConceptKey(concept);
  return conceptKey ? `${supplierRUC}__${conceptKey}` : supplierRUC;
}

function buildCacheKey(entityId: string, supplierRUC: string, concept?: string) {
  return `${entityId}__${buildDocId(supplierRUC, concept)}`;
}

// -------------------------------------------
// SAVE CONTEXTUAL HINT
// -------------------------------------------
export async function saveContextualAccountHint(
  entityId: string,
  uid: string,
  supplierRUC: string,
  supplierName: string | undefined,
  accountCode: string,
  accountName: string,
  concept?: string,
): Promise<void>
{
  // -----------------------------
  // HARD VALIDATION
  // -----------------------------
  if ( !entityId || !uid || !supplierRUC || !accountCode || !accountName) return;

  // -----------------------------
  // AUTH SAFETY
  // -----------------------------
  const authUid = auth.currentUser?.uid;
  if (!authUid || authUid !== uid) {
    console.warn( "Hint skipped: no auth session" );
    return;
  }

  // -----------------------------
  // ACCOUNT FILTERS
  // -----------------------------
  if (
    accountCode.startsWith("133") ||
    accountCode.startsWith("213") ||
    accountCode.startsWith("201") ||
    accountCode.startsWith("211")
  ) {
    return;
  }

  if (!accountCode.startsWith("5")) return;

  const docId = buildDocId(supplierRUC, concept);
  const cacheKey = buildCacheKey(entityId, supplierRUC, concept);

  const ref = doc(db, "entities", entityId, "contextualAccountHints", docId);
  const now = Date.now();

  try {
    const snap = await getDoc(ref);
  
    // -----------------------------
    // CREATE NEW
    // -----------------------------
    if (!snap.exists()) {
      const hint: AccountHint = {
        entityId,
        uid,
        supplierRUC,
        supplierName: supplierName ?? "",
        accountCode,
        accountName,
        concept: concept ?? "",
        frequency: 1,
        createdAt: now,
        updatedAt: now
      };

      await setDoc(ref, hint);
      updateLocalCache(cacheKey, hint);
      return;
    }

    const data = snap.data() as AccountHint;

    // -----------------------------
    // REINFORCE SAME ACCOUNT
    // -----------------------------
    if (data.accountCode === accountCode) {
      const newFrequency = (data.frequency ?? 1) + 1;
      await updateDoc(ref, { 
        supplierName: supplierName ?? data.supplierName ?? "",
        frequency: newFrequency,
        updatedAt: now,
      });

      updateLocalCache(cacheKey, { 
        ...data, 
        frequency: newFrequency, 
        updatedAt: now 
      });

      return;
    }

    // -----------------------------
    // DIFFERENT ACCOUNT → conservative overwrite
    // -----------------------------
    if ((data.frequency ?? 1) < 3) {
      const newFrequency = (data.frequency ?? 1) + 1;

      await updateDoc(ref, {
        accountCode,
        accountName,
        supplierName: supplierName ?? data.supplierName ?? "",
        concept: concept ?? data.concept ?? "",
        frequency: newFrequency,
        updatedAt: now,
      });

      updateLocalCache(cacheKey, {
        ...data,
        accountCode,
        accountName,
        supplierName: supplierName ?? data.supplierName ?? "",
        concept: concept ?? data.concept ?? "",
        frequency: newFrequency,
        updatedAt: now,
      });
    }

  } catch (err: any) {
    console.warn("Contextual learning skipped:", err?.message ?? err);
  }
}

// -------------------------------------------
// GET CONTEXTUAL HINT
// -------------------------------------------

export async function getContextualAccountHint(
  entityId: string,
  uid: string,
  supplierRUC: string,
  concept?: string
): Promise<AccountHint | null> {

  if (!entityId || !uid || !supplierRUC)
    return null;

  const authUid = auth.currentUser?.uid;
  if (!authUid || authUid !== uid)
    return null;

  const docId = buildDocId(supplierRUC, concept);
  const cacheKey = buildCacheKey(entityId, supplierRUC, concept);

  // -----------------------------
  // CHECK LOCAL CACHE FIRST
  // -----------------------------
  try {
    const cache = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
    const cached = cache[cacheKey] as AccountHint | undefined;

    if (cached && (cached.frequency ?? 0) >= MIN_HINT_FREQUENCY)
      return cached;
  } catch {
    localStorage.removeItem(LOCAL_KEY);
  }

  // -----------------------------
  // FETCH FROM FIRESTORE
  // -----------------------------
  try {
    const ref = doc(
      db,
      "entities",
      entityId,
      "contextualAccountHints",
      docId
    );

    const snap = await getDoc(ref);
    if (!snap.exists())
      return null;

    const hint = snap.data() as AccountHint;

    if ((hint.frequency ?? 0) < MIN_HINT_FREQUENCY)
      return null;

    updateLocalCache(cacheKey, hint);
    return hint;

  } catch (err: any) {
    console.warn("Contextual hint read skipped:", err?.message ?? err);
    return null;
  }
}

// -------------------------------------------
// CLEAR CACHE
// -------------------------------------------
export function clearLocalHints() {
  localStorage.removeItem(LOCAL_KEY);
}