// src/services/aiLearningService.ts
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase-config";

/**
 * Save a hint so next time the AI prefers this account.
 * Keyed by entity + (counterparty RUC OR invoice_number OR free key).
 */
export async function saveAccountHint(params: {
  entityId: string;
  userId: string;
  hintKey: string;             // e.g., supplier RUC or cleaned vendor name
  account_code: string;
  account_name: string;
  type?: "income" | "expense" | "asset" | "liability" | "equity";
}) {
  const { entityId, userId, hintKey, account_code, account_name, type } = params;
  const id = hintKey.replace(/[^\w.-]/g, "_").slice(0, 128);
  const ref = doc(db, "entities", entityId, "aiHints", id);
  await setDoc(ref, {
    account_code,
    account_name,
    type: type ?? null,
    userId,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}