// =======================================================
// SERVER VERSION — NO auth.currentUser, NO localStorage
// =======================================================

import { adminDb } from "./firebaseAdmin";

export interface AccountHint {

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


// normalize concept EXACTLY same as client
function normalizeConcept(concept?: string)
{

  return (concept ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);

}


export async function getContextualAccountHintServer(

  uid: string,

  supplierRUC: string,

  concept?: string

): Promise<AccountHint | null>
{

  if (!uid || !supplierRUC)
    return null;


  const conceptKey =
    normalizeConcept(concept);


  const docId =
    conceptKey.length > 0
      ? `${uid}__${supplierRUC}__${conceptKey}`
      : `${uid}__${supplierRUC}`;


  const ref =
    adminDb
      .collection("contextualAccountHints")
      .doc(docId);


  const snap =
    await ref.get();


  if (!snap.exists)
    return null;


  return snap.data() as AccountHint;

}