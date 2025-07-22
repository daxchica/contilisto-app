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
} from "firebase/firestore";

/**
 * Guarda el número de factura procesada en Firestore para evitar duplicados.
 */
export async function logProcessedInvoice(
  entityId: string,
  invoiceNumber: string,
): Promise<void> {
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
      invoice_number: invoiceNumber,
      userId: uid,
      invoicePath: invoiceRef.path
    });

  try {
    await setDoc(invoiceRef, {
      invoice_number: invoiceNumber,
      userId: uid,
      timestamp: new Date().toISOString()
    }, { merge: false });
    
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

    const deleteOps = snapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deleteOps);

    console.log(`🧹 Cleared ${deleteOps.length} invoice logs for entity: ${entityId}`);
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
    const batch = writeBatch(db);

    invoiceNumbers.forEach((invoiceNumber) => {
      const docRef = doc(db, "entities", entityId, "invoiceLogs", invoiceNumber);
      batch.delete(docRef);
    });

    await batch.commit();
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
  
  try {
    const testRef = doc(db, "entities", entityId, "invoiceLogs", "TEST-INVOICE-123");

    await setDoc(testRef, {
      invoice_number: "TEST-INVOICE-123",
      userId: uid,
      timestamp: new Date().toISOString()
    });

    console.log("🧾 Logging invoice with userId:", uid);
    console.log("📍 Invoice path:", testRef.path);
  } catch (error) {
    console.error("❌ Test invoice log write failed:", error);
    throw error;
  }
}