import { adminDb } from "../_server/firebaseAdmin"; 
// or whatever you already use for server-side Firestore.
// If you don't have firebaseAdmin, tell me and I’ll adapt to your setup.

import { normalizeConcept } from "./utils/normalizeConcept"; 
// if Netlify can't import from src, copy normalizeConcept into _server instead.

export type ContextualHint = {
  uid: string;
  supplierRUC: string;
  supplierName?: string;
  concept: string;
  accountCode: string;
  accountName: string;
  frequency: number;
  createdAt: number;
};

export async function getContextualHint(
  uid: string,
  supplierRUC: string,
  rawConcept?: string
): Promise<{ accountCode: string; accountName: string } | null> {
  if (!uid || !supplierRUC || !rawConcept) return null;

  const concept = normalizeConcept(rawConcept);
  if (!concept) return null;

  const docId = `${uid}__${supplierRUC}__${concept}`;

  const snap = await adminDb.collection("contextualAccountHints").doc(docId).get();
  if (!snap.exists) return null;

  const data = snap.data() as ContextualHint;
  if (!data?.accountCode || !data?.accountName) return null;

  return { accountCode: data.accountCode, accountName: data.accountName };
}