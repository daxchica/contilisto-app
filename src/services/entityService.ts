// src/services/entityService.ts

import { db } from "../firebase-config";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
} from "firebase/firestore";

import type { Entity, EntityType } from "../types/Entity";
import type { JournalEntry } from "@/types/JournalEntry";
import { uidOrThrow } from "../utils/auth";

/**
 * Guarda múltiples entradas contables en Firestore, validando campos requeridos.
 */

export async function createEntity(params: { 
  id?: string; 
  ruc: string; 
  name: string;
  type: string; 
}): Promise<string> {
  const uid = uidOrThrow();

  const data: Entity = {
    uid,
    name: params.name.trim(),
    ruc: params.ruc.trim(),
    type: params.type as EntityType,
    createdAt: Date.now(),
  };

  if (params.id) {
    await setDoc(doc(db, "entities", params.id), data, { merge: true });
    return params.id;
  }

  const ref = await addDoc(collection(db, "entities"), data);
  return ref.id;
}

/**
 * Elimina una entidad por ID
 */
export async function deleteEntity(entityId: string): Promise<void> {
  const uid = uidOrThrow();
  const ref = doc(db, "entities", entityId);

  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data() as Entity;

  if (snap.data().uid !== uid) {
    throw new Error("SECURITY: cannot delete entity not owned by user");
  }

  await deleteDoc(ref);
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

/* ============================================================================
 * JOURNAL ENTRIES
 * ============================================================================ */

/**
 * Guarda múltiples entradas contables en Firestore
 * - Usa subcolección: entities/{entityId}/journalEntries
 * - Valida campos requeridos
 * - Valida ownership de la entity antes de escribir (defensivo)
 */
export async function saveJournalEntries(entries: JournalEntry[]) {
  if (!entries || entries.length === 0) {
    console.warn("No journal entries provided to save.");
    return;
  }

  const uid = uidOrThrow();

  const promises = entries.map(async (entry) => {
    // Validar y asegurar campos requeridos
    if (!entry.entityId || !entry.account_code || !entry.date || !entry.userId) {
      console.warn("Entrada contable inválida, se omitirá:", entry);
      return;
    }

    // ✅ Validación defensiva: el userId del entry debe ser el del usuario actual
    if (entry.userId !== uid) {
      console.warn("SECURITY: userId mismatch, se omitirá:", entry);
      return;
    }

    // ✅ Validación defensiva: la entity debe pertenecer al usuario
    const entityRef = doc(db, "entities", entry.entityId);
    const entitySnap = await getDoc(entityRef);
    if (!entitySnap.exists()) {
      console.warn("Entity no existe, se omitirá:", entry.entityId);
      return;
    }
    const entityData = entitySnap.data() as Entity;
    if (entityData.uid !== uid) {
      console.warn("SECURITY: entity not owned by user, se omitirá:", entry.entityId);
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
  if (!entityId) return [];

  const q = collection(db, "entities", entityId, "journalEntries");
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ 
    id: d.id, 
    ...(d.data() as JournalEntry) 
  }));
}

/**
 * Elimina las entradas contables asociadas a una factura por su número.
 */
export async function deleteJournalEntriesByInvoiceNumber(
  entityId: string,
  invoiceNumbers: string[]
): Promise<void> {
  if (!entityId || invoiceNumbers.length === 0) return;

  const colRef = collection(db, "entities", entityId, "journalEntries"); // ✔️ subcolección correcta
  const q = query(colRef, where("invoice_number", "in", invoiceNumbers));
  const snap = await getDocs(q);

  const deletions = snap.docs.map((docRef) => deleteDoc(docRef.ref));
  await Promise.all(deletions);
}

