// src/services/entityService.ts

import { 
  addDoc, 
  collection, 
  deleteDoc, 
  doc, 
  getDoc,
  getDocs, 
  query, 
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase-config";
import { getAuth } from "firebase/auth";

export type Entity = { 
  id: string; 
  ruc: string; 
  name: string;
  uid: string;
  createdAt?: string;
};

/** Ensure we have a signed-in user and return uid */
function uidOrThrow(): string {
  const uid = getAuth().currentUser?.uid || "";
  if (!uid) throw new Error("Not signed in");
  return uid;
}

/** List entities owned by the signed-in user (reads from /entities) */
export async function fetchEntities(): Promise<Entity[]> {
  const uid = uidOrThrow();
  try {
    const colRef = collection(db, "entities");
    const q = query(colRef, where("uid", "==", uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Entity, "id">) }));
  } catch (err) {
    console.error("fetchEntities failed:", err);
    return [];
  }
}

/** Create a new entity (at /entities) */
export async function createEntity(params: { id?: string, ruc: string, name: string }) {
  const uid = uidOrThrow();
  const data = {
    uid,
    name: params.name.trim(),
    ruc: params.ruc.trim(),
    createdAt: new Date().toISOString(),
  };

  if (params.id) {
    // Create with a specific id
    await setDoc(doc(db, "entities", params.id), data);
    return params.id;
  } else {
    // Let Firestore auto-id
    const ref = await addDoc(collection(db, "entities"), data);
    return ref.id;
  }
}


/** (Optional) Read a single entity (verifies it exists & you own it) */
export async function getEntity(entityId: string): Promise<Entity | null> {
  const uid = uidOrThrow();
  const ref = doc(db, "entities", entityId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() as Omit<Entity, "id">;
  // Optional local ownership check (rules already enforce this in prod)
  if (data.uid !== uid) {
    console.warn("getEntity: current user does not own this entity");
    return null;
  }
  return { id: snap.id, ...data };
}

/** Delete an entity you own (rules enforce ownership) */
export async function deleteEntity(entityId: string) {
  uidOrThrow();
  await deleteDoc (doc(db, "entities", entityId));
}