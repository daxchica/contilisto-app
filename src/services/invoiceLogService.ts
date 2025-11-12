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

import { collection, getDocs, query, where } from "firebase/firestore";
import type { JournalEntry } from "../types/JournalEntry";

/**
 * 📦 Obtiene todas las facturas registradas de un proveedor específico
 * según su RUC (issuerRUC), desde Firestore.
 */
export async function getInvoicesBySupplier(
  entityId: string,
  supplierRUC: string
): Promise<JournalEntry[]> {
  if (!entityId || !supplierRUC) {
    console.warn("⚠️ getInvoicesBySupplier called without entityId or supplierRUC");
    return [];
  }

  try {
    const q = query(
      collection(db, "entities", entityId, "journalEntries"),
      where("issuerRUC", "==", supplierRUC)
    );

    const snapshot = await getDocs(q);
    const entries: JournalEntry[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as JournalEntry[];

    console.log(`📊 ${entries.length} registros encontrados para proveedor ${supplierRUC}`);
    return entries;
  } catch (err) {
    console.error("❌ Error al obtener facturas del proveedor:", err);
    return [];
  }
}