// src/services/entityService.ts
import { db } from "../firebase-config";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import type { Entity, EntityType } from "../types/Entity";
import { uidOrThrow } from "../utils/auth";
import type { JournalEntry } from "@/types/JournalEntry";

/* =========================
   ENTITIES
========================= */

export async function createEntity(params: {
  id?: string;
  ruc: string;
  name: string;
  type: EntityType;
  address?: string;
  phone?: string;
  email?: string;
}): Promise<string> {
  const uid = uidOrThrow();

  const data: Omit<Entity, "id"> = {
    uid,
    name: params.name.trim(),
    ruc: params.ruc.trim(),
    type: params.type,
    address: params.address?.trim() ?? "",
    phone: params.phone?.trim() ?? "",
    email: params.email?.trim() ?? "",

    obligadoContabilidad: true,
    
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const ref = await addDoc(collection(db, "entities"), data);
  return ref.id;
}

export async function updateEntity(
  entityId: string,
  data: {
    name: string;
    type: EntityType;
    address?: string;
    phone?: string;
    email?: string;
  }
): Promise<void> {
  const uid = uidOrThrow();
  const ref = doc(db, "entities", entityId);

  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Entity does not exist");

  const entity = snap.data() as Entity;
  if (entity.uid !== uid) {
    throw new Error("SECURITY: cannot update entity not owned by user");
  }

  await updateDoc(ref, {
    name: data.name.trim(),
    type: data.type,
    address: data.address?.trim() ?? "",
    phone: data.phone?.trim() ?? "",
    email: data.email?.trim() ?? "",
    updatedAt: serverTimestamp(),
  });
}

/* =========================
   DELETE ENTITY
========================= */
export async function deleteEntity(entityId: string): Promise<void> {
  const uid = uidOrThrow();
  const ref = doc(db, "entities", entityId);

  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const entity = snap.data() as Entity;
  if (entity.uid !== uid) {
    throw new Error("SECURITY: cannot delete entity not owned by user");
  }

  await deleteDoc(ref);
}

/* =========================
   FETCH ENTITIES
========================= */
export async function fetchEntities(uid: string): Promise<Entity[]> {
  const q = query(
    collection(db, "entities"),
    where("uid", "==", uid),
  );

  const snap = await getDocs(q);

  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Entity) }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function fetchJournalEntries(
  entityId: string
): Promise<JournalEntry[]> {
  if (!entityId) return [];

  const colRef = collection(db, "entities", entityId, "journalEntries");
  const snap = await getDocs(colRef);

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as JournalEntry),
  }));
}