// src/services/aiLearningService.ts
import { doc, setDoc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "../firebase-config";

function sanitizeKey(key: string): string {
  return key.replace(/[^\w.-]/g, "_").slice(0, 128);
}

function isValidAccountCode(code: string): boolean {
  return /^\d+$/.test(code);
}

/**
 * Save a hint so next time the AI prefers this account.
 * Keyed by entity + (counterparty RUC OR invoice_number OR free key).
 */
export async function saveAccountHint(params: {
  entityId: string;
  userIdSafe: string;
  hintKey: string;             // e.g., supplier RUC or cleaned vendor name
  account_code: string;
  account_name: string;
  type?: "income" | "expense" | "asset" | "liability" | "equity";
}) {
  const { entityId, userIdSafe, hintKey, account_code, account_name, type } = params;

  if (!entityId || !userIdSafe || !hintKey) return;
  if (!isValidAccountCode(account_code)) return;

  const id = sanitizeKey(hintKey);
  const ref = doc(db, "entities", entityId, "aiHints", id);
  
  await setDoc(ref, {
    account_code,
    account_name,
    type: type ?? null,
    userIdSafe,
  
    frequency: increment(1),

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}