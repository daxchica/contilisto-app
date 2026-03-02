// src/services/entityService.ts
import { db } from "../firebase-config";
import {
  collection,
  collectionGroup,
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
import { getUidOrThrow } from "./firestoreSecurity";
import { requireEntityId } from "./requireEntityId";
import { initializeEntityCOA } from "./coaService";

/* =========================
   ENTITIES
========================= */

export async function createEntity(data: {
  ruc: string;
  name: string;
  type: EntityType;
  address?: string;
  phone?: string;
  email?: string;
}): Promise<string> {
  const uid = getUidOrThrow();

  const entityRef = doc(collection(db, "entities"));

  await setDoc(entityRef, {
    ruc: data.ruc.trim(),
    name: data.name.trim(),
    type: data.type,
    address: data.address?.trim() ?? null,
    phone: data.phone?.trim() ?? null,
    email: data.email?.trim() ?? null,
    createdAt: serverTimestamp(),
    createdBy: uid,
  });

  // Create membership document
  await setDoc(entityRef, {
    ruc: data.ruc.trim(),
    name: data.name.trim(),
    type: data.type,
    address: data.address?.trim() ?? null,
    phone: data.phone?.trim() ?? null,
    email: data.email?.trim() ?? null,
    createdAt: serverTimestamp(),
    createdBy: uid,
  });

  await setDoc(doc(db, "entities", entityRef.id, "members", uid), {
    uid,
    role: "owner",
    invitedBy: uid,
    createdAt: serverTimestamp(),
  });

  // ✅ HARD REQUIREMENT: every entity gets its own COA
  await initializeEntityCOA(entityRef.id);

  return entityRef.id;
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
  requireEntityId(entityId, "actualizar entidad");
  const uid = getUidOrThrow();

  // Check membership role
  const memberRef = doc(db, "entities", entityId, "members", uid);
  const memberSnap = await getDoc(memberRef);

  if (!memberSnap.exists() || memberSnap.data().role !== "owner") {
    throw new Error("SECURITY: Only owner can update entity");
  }

  await updateDoc(doc(db, "entities", entityId), {
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
  requireEntityId(entityId, "eliminar entidad");
  const uid = getUidOrThrow();

  const memberRef = doc(db, "entities", entityId, "members", uid);
  const memberSnap = await getDoc(memberRef);

  if (!memberSnap.exists() || memberSnap.data().role !== "owner") {
    throw new Error("SECURITY: Only owner can delete entity");
  }

  await deleteDoc(doc(db, "entities", entityId));
}

/* =========================
   FETCH ENTITIES
========================= */
export async function fetchEntities(): Promise<Entity[]> {
  const uid = getUidOrThrow();

  // 1️⃣ Get all membership docs for current user
  const membershipQuery = query(
    collectionGroup(db, "members"),
    where("uid", "==", uid)
  );

  const membershipSnap = await getDocs(membershipQuery);

  if (membershipSnap.empty) return [];

  // 2️⃣ Extract entity IDs
  const entityIds = membershipSnap.docs
    .map(d => d.ref.parent.parent?.id)
    .filter(Boolean) as string[];

  // 3️⃣ Fetch entities in parallel (PROFESSIONAL)
  const entityDocs = await Promise.all(
    entityIds.map(id => getDoc(doc(db, "entities", id)))
  );

  return entityDocs
    .filter(d => d.exists())
    .map(d => ({
      id: d.id,
      ...(d.data() as Entity),
    }));
}
