import { db } from "../firebase-config";
import { collection, doc, setDoc, getDocs, deleteDoc } from "firebase/firestore";

/**
 * Guarda el número de factura procesada en Firestore para evitar duplicados.
 */
export async function logProcessedInvoice(entityId: string, invoiceNumber: string) {
  if (!entityId || !invoiceNumber) return;

  const journalRef = doc(
    collection(db, "entities", entityId, "invoiceLogs"),
    invoiceNumber
  );

  await setDoc(journalRef, {
    invoice_number: invoiceNumber,
    timestamp: new Date().toISOString()
  });
}

// ✅ Borra todos los logs de facturas procesadas en Firestore para una entidad
export async function clearFirestoreLogForEntity(entityId: string) {
  const logRef = collection(db, "entities", entityId, "invoiceLogs");
  const snapshot = await getDocs(logRef);
  const deleteOps = snapshot.docs.map((doc) => deleteDoc(doc.ref));
  await Promise.all(deleteOps);
}