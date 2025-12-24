// src/services/contactService.ts
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase-config";
import type { Contact } from "@/types/Contact";

function normalizeIdentification(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export async function fetchContacts(entityId: string): Promise<Contact[]> {
  if (!entityId) return [];
  const colRef = collection(db, "entities", entityId, "contacts");
  const snap = await getDocs(colRef);

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Contact, "id">),
  }));
}

async function existsContactByIdentification(
  entityId: string,
  identification: string,
  excludeId?: string
): Promise<boolean> {
  const colRef = collection(db, "entities", entityId, "contacts");
  const normalized = normalizeIdentification(identification);

  const q = query(
    colRef,
    where("identificationNormalized", "==", normalized),
    where("activo", "==", true)
  );

  const snap = await getDocs(q);
  return snap.docs.some((d) => d.id !== excludeId);
}

export async function saveContact(
  entityId: string,
  data: Omit<Contact, "id" | "createdAt" | "updatedAt">,
  contactId?: string
): Promise<void> {
  if (!entityId) throw new Error("entityId requerido para guardar el contacto");

  const colRef = collection(db, "entities", entityId, "contacts");
  const now = Date.now();

  const identificationNormalized = normalizeIdentification(data.identification);

  // ✅ evita duplicados por identificación (RUC/cédula/pasaporte)
  const isDup = await existsContactByIdentification(
    entityId,
    data.identification,
    contactId
  );
  if (isDup) {
    throw new Error("Ya existe un contacto activo con esa identificación.");
  }

  if (contactId) {
    const ref = doc(colRef, contactId);
    await updateDoc(ref, {
      ...data,
      identificationNormalized,
      updatedAt: now,
    });
    return;
  }

  await addDoc(colRef, {
    ...data,
    identificationNormalized,
    activo: data.activo ?? true,
    createdAt: now,
    updatedAt: now,
  });
}

export async function deleteContact(
  entityId: string,
  contactId: string
): Promise<void> {
  if (!entityId || !contactId) return;

  const ref = doc(db, "entities", entityId, "contacts", contactId);
  await updateDoc(ref, {
    activo: false,
    updatedAt: Date.now(),
  });
}

export async function fetchContactsByRole(
  entityId: string,
  role: "cliente" | "proveedor"
): Promise<Contact[]> {
  const all = await fetchContacts(entityId);
  return all.filter(
    (c) => c.activo && (c.role === role || c.role === "ambos")
  );
}

export async function fetchClientContacts(entityId: string): Promise<Contact[]> {
  return fetchContactsByRole(entityId, "cliente");
}