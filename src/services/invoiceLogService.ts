// src/services/invoiceLogService.ts
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase-config";

// 🧾 Elimina facturas específicas del log Firestore
export async function deleteInvoicesFromFirestore(entityId: string, invoiceNumbers: string[]) {
  const docRef = doc(db, "invoice_logs", entityId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return;

  const existing = docSnap.data();
  const updated = { ...existing };

  invoiceNumbers.forEach(id => delete updated[id]);

  await updateDoc(docRef, updated);
}

// 🧾 Elimina facturas del log localStorage
export function deleteInvoicesFromLocal(ruc: string, invoiceNumbers: string[]) {
  const raw = localStorage.getItem(`processedInvoices-${ruc}`);
  if (!raw) return;
  const log = JSON.parse(raw);

  invoiceNumbers.forEach(id => delete log[id]);

  localStorage.setItem(`processedInvoices-${ruc}`, JSON.stringify(log));
}

// 📋 Obtiene el listado de facturas procesadas (ambos logs)
export async function getInvoiceLogs(entityId: string, ruc: string): Promise<string[]> {
  const idsSet = new Set<string>();

  // Firestore
  try {
    const docRef = doc(db, "invoice_logs", entityId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const firestoreLog = docSnap.data();
      Object.keys(firestoreLog).forEach(id => idsSet.add(id));
    }
  } catch (error) {
    console.warn("⚠️ Error getting Firestore log", error);
  }

  // LocalStorage
  try {
    const raw = localStorage.getItem(`processedInvoices-${ruc}`);
    if (raw) {
      const localLog = JSON.parse(raw);
      Object.keys(localLog).forEach(id => idsSet.add(id));
    }
  } catch (error) {
    console.warn("⚠️ Error getting local log", error);
  }

  return Array.from(idsSet);
}