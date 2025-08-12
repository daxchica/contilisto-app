// src/services/entityService.ts

import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebase-config";
import { User } from "firebase/auth";

type EntityDoc = { id: string; ruc: string; name: string };

// Obtain user's entities
export async function fetchEntities (userId: string): Promise<EntityDoc[]> {
  const col = collection(db, "entities");
  const q = query(col, where("uid", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<EntityDoc, "id">) }));
}

export async function createEntity(userId: string, ruc: string, name: string) {
  const col = collection(db, "entities");
  await addDoc(col, {
    uid: userId,
    ruc: ruc.trim(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  });
}

export async function deleteEntity(entityId: string) {
  await deleteDoc (doc(db, "entities", entityId));
}