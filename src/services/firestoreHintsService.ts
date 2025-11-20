// src/services/firestoreHintsService.ts
// =======================================================
// Service to store and retrieve learned account hints
// linking suppliers (by RUC or name) to preferred accounts
// =======================================================

import { db } from "../firebase-config";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

const HINTS_COLLECTION = "accountHints";
const hintsRef = collection(db, HINTS_COLLECTION);

// LocalStorage key
const LOCAL_KEY = "accountHintsLocal";

// -------------------------------------------
// 📘 Type definition
// -------------------------------------------
export interface AccountHint {
  supplier_ruc?: string;
  supplier_name?: string;
  account_code: string;
  account_name: string;
  updatedAt?: string;
}

// -------------------------------------------
// 🧠 Retrieve hint from Firestore or LocalStorage
// -------------------------------------------
export async function getAccountHint(
  issuerRUC?: string,
  supplier_name?: string
): Promise<AccountHint | null> {
  try {
    // 1️⃣ Local cache first (fast)
    let cachedHints: Record<string, AccountHint> = {};
    try {
        cachedHints = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
  } catch {
    console.warn("Corrupted local account hint cache, resetting");
    localStorage.removeItem(LOCAL_KEY);
  }

    if (issuerRUC && cachedHints[issuerRUC]) return cachedHints[issuerRUC];
    if (supplier_name && cachedHints[supplier_name]) return cachedHints[supplier_name];

    // 2️⃣ Firestore lookup
    const keys = [issuerRUC, supplier_name].filter(Boolean);
    if (keys.length === 0) {
        console.warn("getAccountHint called with no valid identifiers");
        return null;
    }

    // Query by RUC first; fallback to supplier name if no match
    let snapshot = await getDocs(query(hintsRef, where("supplier_ruc", "in", keys)));
    if (snapshot.empty) {
        snapshot = await getDocs(query(hintsRef, where("supplier_name", "in", keys)));
    }

    if (snapshot.empty) {
        console.log("No account hint found for", keys);
        return null;
    }
    
    const docData = snapshot.docs[0].data() as AccountHint;
    
    // Cache locally for future use
    const cacheKey = docData.supplier_ruc || docData.supplier_name;
    if (cacheKey) {
        cachedHints[cacheKey] = docData;
        localStorage.setItem(LOCAL_KEY, JSON.stringify(cachedHints));
    }

    return docData;
  } catch (err) {
    console.error("⚠️ Error in getAccountHint:", err);
    return null;
    }
}

// -------------------------------------------
// 🧠 Save account hint (Firestore + LocalStorage)
// -------------------------------------------
export async function saveAccountHint(
  supplier_ruc: string | undefined,
  supplier_name: string | undefined,
  account_code: string,
  account_name: string
): Promise<void> {
  if (!supplier_ruc && !supplier_name) return;
  try {
    const key = supplier_ruc || supplier_name || "";
    const hint: AccountHint = {
      supplier_ruc,
      supplier_name,
      account_code,
      account_name,
      updatedAt: new Date().toISOString(),
    };

    // 🧩 Firestore
    const docRef = doc(db, "accountHints", key);
    await setDoc(docRef, { key, ...hint }, { merge: true });

    // 💾 Local cache
    const cachedHints = JSON.parse(localStorage.getItem("accountHintsLocal") || "{}");
    cachedHints[key] = hint;
    localStorage.setItem("accountHintsLocal", JSON.stringify(cachedHints));

    console.log(`✅ Saved account hint for ${supplier_name || supplier_ruc}: ${account_code} – ${account_name}`);
  } catch (err) {
    console.error("❌ Error saving account hint:", err);
  }
}

/**
 * 🧹 Clears all locally cached account hints.
 */
export function clearLocalHints() {
  localStorage.removeItem("accountHintsLocal");
  console.log("🧹 Cleared local account hint cache");
}
