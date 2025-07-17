// src/services/firestoreLogService.ts
import { db } from "../firebase-config";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  deleteField,
  writeBatch
} from "firebase/firestore";


/**
 * Guarda el número de factura procesada en Firestore para evitar duplicados.
 */
export async function logProcessedInvoice(entityId: string, invoiceNumber: string) {
  if (!entityId || !invoiceNumber) return;

  const invoiceRef = doc(db, "entities", entityId, "invoiceLogs", invoiceNumber);

  await setDoc(invoiceRef, {
    invoice_number: invoiceNumber,
    timestamp: new Date().toISOString()
  });
}

/**
 * Borra todos los logs de facturas procesadas en Firestore para una entidad.
 */
export async function clearFirestoreLogForEntity(entityId: string) {
  const logRef = collection(db, "entities", entityId, "invoiceLogs");
  const snapshot = await getDocs(logRef);
  const deleteOps = snapshot.docs.map((doc) => deleteDoc(doc.ref));
  await Promise.all(deleteOps);
}

/**
 * Borra logs específicos de facturas procesadas por número.
 */
export async function deleteInvoicesFromFirestoreLog(entityId: string, invoiceNumbers: string[]) {
  if (!entityId || invoiceNumbers.length === 0) return;

  const batch = writeBatch(db);
  invoiceNumbers.forEach((invoiceNumber) => {
    const docRef = doc(db, "entities", entityId, "invoiceLogs", invoiceNumber);
    batch.delete(docRef);
  });

  await batch.commit();
}