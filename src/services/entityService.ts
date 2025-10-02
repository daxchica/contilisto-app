// src/services/journalService.ts

import { db } from "../firebase-config";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  setDoc,
} from "firebase/firestore";

import type { Entity } from "../types/Entity";
import type { JournalEntry } from "@/types/JournalEntry";
import { uidOrThrow } from "../utils/auth";
// import type { JournalEntry } from "../types/JournalEntry";

/**
 * Guarda múltiples entradas contables en Firestore, validando campos requeridos.
 */

export async function createEntity(params: { id?: string; ruc: string; name: string }): Promise<string> {
  const uid = uidOrThrow();
  const data: Entity = {
    uid: uid,
    name: params.name.trim(),
    ruc: params.ruc.trim(),
    createdAt: Date.now(),
  };

  if (params.id) {
    await setDoc(doc(db, "entities", params.id), data);
    return params.id;
  } else {
    const ref = await addDoc(collection(db, "entities"), data);
    return ref.id;
  }
}

/**
 * Elimina una entidad por ID
 */
export async function deleteEntity(entityId: string): Promise<void> {
  await deleteDoc(doc(db, "entities", entityId));
}

/**
 * Obtiene las entidades asociadas a un usuario por UID
 */
export async function fetchEntities(uid: string): Promise<Entity[]> {
  const q = query(collection(db, "entities"), where("uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({
    ...(doc.data() as Entity),
    id: doc.id,
  }));
}

export async function saveJournalEntries(entries: JournalEntry[]) {
  if (!entries || entries.length === 0) {
    console.warn("No journal entries provided to save.");
    return;
  }
  const promises = entries.map(async (entry) => {
    // Validar y asegurar campos requeridos
    if (!entry.entityId || !entry.account_code || !entry.date || !entry.userId) {
      console.warn("Entrada contable inválida, se omitirá:", entry);
      return;
    }

    // referencia correcta a subcoleccion de la entidad
    const journalRef = collection(db, "entities", entry.entityId, "journalEntries");

    // normalizar
    const sanitizedEntry: JournalEntry = {
      ...entry,
      debit: typeof entry.debit === "number" ? entry.debit : parseFloat(entry.debit || "0"),
      credit: typeof entry.credit === "number" ? entry.credit : parseFloat(entry.credit || "0"),
      createdAt: typeof entry.createdAt === "string" 
        ? entry.createdAt 
        : Date.now(),
    };

    await addDoc(journalRef, sanitizedEntry);
  });

  await Promise.all(promises);
  console.log(`[✅] ${entries.length} journal entries saved.`);
}

/**
 * Obtiene las entradas contables asociadas a una entidad específica.
 */
export async function fetchJournalEntries(entityId: string): Promise<JournalEntry[]> {
  const q = query(collection(db, "journalEntries"), where("entityId", "==", entityId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as JournalEntry) }));
}

/**
 * Elimina las entradas contables asociadas a una factura por su número.
 */
export async function deleteJournalEntriesByInvoiceNumber(invoiceNumber: string, entityId: string) {
  const q = query(
    collection(db, "journalEntries"),
    where("invoice_number", "==", invoiceNumber),
    where("entityId", "==", entityId)
  );
  const snap = await getDocs(q);
  const deletions = snap.docs.map((docRef) => deleteDoc(docRef.ref));
  await Promise.all(deletions);
}