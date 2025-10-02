// src/services/firestoreLogService.ts

import { getAuth } from "firebase/auth";
import { db } from "../firebase-config";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  QueryDocumentSnapshot,
} from "firebase/firestore";

/** ---------- helpers ---------- */
const authUid = () => getAuth().currentUser?.uid ?? null;

async function commitInBatches(refs: Array<QueryDocumentSnapshot["ref"] | ReturnType<typeof doc>>) {
  // Firestore write batch limit is 500
  for (let i = 0; i < refs.length; i += 500) {
    const batch = writeBatch(db);
    for (const r of refs.slice(i, i + 500)) batch.delete(r);
    await batch.commit();
  }
}

/**
 * Guarda el número de factura procesada en Firestore para evitar duplicados.
 */
export async function fetchProcessedInvoice(entityId: string, invoiceNumber: string,): Promise<void> {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;

  if (!entityId || !invoiceNumber || !uid) {
    console.warn("❌ logProcessedInvoice called with missing parameters.", {
      entityId,
      invoiceNumber,
      uid
    });
    return;
  }

  const invoiceRef = doc(db, "entities", entityId, "invoiceLogs", invoiceNumber);

  console.log("Logging invoice:", {
      entityId,
      invoice_number: invoiceNumber,
      userId: uid,
      invoicePath: invoiceRef.path
    });

  try {
    await setDoc(invoiceRef, {
      // 🔐 Required by your Firestore rules
        entityId,
        userId: uid,

      // Data
        invoice_number: invoiceNumber,
        createdAt: serverTimestamp(),
    }, { merge: true } // idempotent
  );
    
  console.log(`🧾 Invoice log saved for invoice: ${invoiceNumber}`);
  } catch (error) {
    console.error(`Error logging invoice ${invoiceNumber}`, error);
    throw error;
  }
}

/**
 * Borra todos los logs de facturas procesadas en Firestore para una entidad.
 */
export async function clearFirestoreLogForEntity(entityId: string): Promise<void> {
  if (!entityId) {
    console.warn("❌ clearFirestoreLogForEntity called without entityId");
    return;
  }

  try {
    const logRef = collection(db, "entities", entityId, "invoiceLogs");
    const snapshot = await getDocs(logRef);

    const refs = snapshot.docs.map((d) => d.ref);
    await commitInBatches(refs);

    console.log(`🧹 Cleared ${refs.length} invoice logs for entity: ${entityId}`);
  } catch (error) {
    console.error("❌ Error clearing invoice logs:", error);
    throw error;
  }
}

/**
 * Borra logs específicos de facturas procesadas por número.
 */
export async function deleteInvoicesFromFirestoreLog(
  entityId: string,
  invoiceNumbers: string[]
): Promise<void> {
  if (!entityId || invoiceNumbers.length === 0) {
    console.warn("❌ deleteInvoicesFromFirestoreLog called with missing parameters");
    return;
  }

  try {
    const refs = invoiceNumbers.map((n) =>
      doc(db, "entities", entityId, "invoiceLogs", n)
    );

    await commitInBatches(refs);

    console.log(`🗑️ Deleted ${invoiceNumbers.length} invoice logs for entity: ${entityId}`);
  } catch (error) {
    console.error("❌ Error deleting specific invoice logs:", error);
    throw error;
  }
}

/**
 * Utilidad para probar escritura de logs de factura.
 */
export async function testInvoiceLogWrite(entityId: string): Promise<void> {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;

  if (!uid) {
    console.warn("❌ No authenticated user for testInvoiceLogWrite");
    throw new Error("No authenticated user");
  }

  if (!entityId) {
    console.warn("❌ testInvoiceLogWrite called without entityId");
    throw new Error("Missing entityId");
  }
  
  try {
    const testRef = doc(db, "entities", entityId, "invoiceLogs", "TEST-INVOICE-123");
    await setDoc(testRef, {
      entityId,
      userId: uid,
      invoice_number: "TEST-INVOICE-123",
      createdAt: serverTimestamp(),
    }, { merge: true });

    console.log("🧾 Test invoice logged", { path: testRef.path, userId: uid});
  } catch (error) {
    console.error("❌ Test invoice log write failed:", error);
    throw error;
  }
}

export type ProcessedInvoice = {
  entityId: string;
  userId: string;
  invoice_number: string;
  createdAt: any;
};