import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

export interface AccountHint {
  supplierRUC: string;
  accountCode: string;
  accountName: string;
  updatedAt: number;
}

export async function getAccountHintBySupplierRUC(
  supplierRUC: string
): Promise<AccountHint | null> {
  if (!supplierRUC) return null;

  const snap = await db
    .collection("accountHints")
    .doc(supplierRUC)
    .get();

  if (!snap.exists) return null;

  return snap.data() as AccountHint;
}