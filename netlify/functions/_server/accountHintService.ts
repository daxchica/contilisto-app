// netlify/functions/_server/accountHintService.ts

import { adminDb } from "./firebaseAdmin";

/* -------------------------------------------
   Types
-------------------------------------------- */

export interface AccountHint {
  supplierRUC: string;
  accountCode: string;
  accountName: string;
  updatedAt: number;
}

/* -------------------------------------------
   Read account hint (SAFE)
-------------------------------------------- */

export async function getAccountHintBySupplierRUC(
  supplierRUC?: string
): Promise<AccountHint | null> {
  try {
    if (!supplierRUC || typeof supplierRUC !== "string") {
      return null;
    }

    const snap = await adminDb
      .collection("accountHints")
      .doc(supplierRUC)
      .get();

    if (!snap.exists) return null;

    return snap.data() as AccountHint;
  } catch (error) {
    console.error(
      "❌ getAccountHintBySupplierRUC failed:",
      error
    );
    return null;
  }
}