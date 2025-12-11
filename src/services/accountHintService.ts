// src/services/accountHintService.ts
import { db, auth } from "../firebase-config";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  addDoc,
  DocumentData,
  QueryDocumentSnapshot,
  limit,
} from "firebase/firestore";

export interface AccountHint {
  id?: string;
  supplierRUC: string;
  accountCode: string;
  accountName: string;
  frequency: number;
  createdAt?: string;
  updatedAt?: string;
  uid?: string;
}

const COLLECTION_NAME = "accountHints";

/**
 * Guarda / incrementa la sugerencia de cuenta
 * para un proveedor (supplierRUC + accountCode).
 */
export async function saveAccountHint(hint: {
  supplierRUC: string;
  accountCode: string;
  accountName: string;
  userId: string;
}) {
  if (!hint.supplierRUC || !hint.accountCode) return;

  const user = auth.currentUser;
  if (!user) return; // seguridad extra en frontend

  const ref = collection(db, COLLECTION_NAME);

  const q = query(
    ref,
    where("supplierRUC", "==", hint.supplierRUC),
    where("accountCode", "==", hint.accountCode),
    where("uid", "==", user.uid) // 1 proveedor + 1 cuenta + 1 usuario
  );

  const snap = await getDocs(q);

  if (!snap.empty) {
    const docRef = snap.docs[0].ref;
    const current = snap.docs[0].data() as AccountHint;

    await updateDoc(docRef, {
      frequency: (current.frequency || 0) + 1,
      accountName: hint.accountName,
      updatedAt: new Date().toISOString(),
    });
  } else {
    await addDoc(ref, {
      supplierRUC: hint.supplierRUC,
      accountCode: hint.accountCode,
      accountName: hint.accountName,
      frequency: 1,
      uid: user.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

/**
 * Trae los hints de un proveedor para el usuario actual.
 * NO usa orderBy en Firestore → no requiere índice compuesto.
 * Ordenamos por frequency en memoria.
 */
export async function fetchAccountHintsBySupplierRUC(
  supplierRUC: string
): Promise<AccountHint[]> {
  if (!supplierRUC) return [];

  const user = auth.currentUser;
  if (!user) return [];

  const ref = collection(db, COLLECTION_NAME);

  // 👇 SOLO where → no requiere índice compuesto
  const q = query(
    ref,
    where("supplierRUC", "==", supplierRUC),
    where("uid", "==", user.uid),
    limit(50)
  );

  const snap = await getDocs(q);

  const rows: AccountHint[] = snap.docs.map(
    (d: QueryDocumentSnapshot<DocumentData>) => {
      const data = d.data() as AccountHint;
      return {
        id: d.id,
        ...data,
      };
    }
  );

  // Ordenamos en memoria por frecuencia descendente
  rows.sort((a, b) => (b.frequency || 0) - (a.frequency || 0));

  return rows;
}