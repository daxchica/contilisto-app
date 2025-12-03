// src/services/clientService.ts
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/firebase-config";
import { getAuth } from "firebase/auth";

export interface Client {
  id: string;
  entityId: string;
  userId: string;
  tipo_identificacion: "ruc" | "cedula" | "pasaporte";
  identificacion: string;
  razon_social: string;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  tipo_cliente?: "regular" | "preferencial" | "mayorista";
  createdAt: number;
  updatedAt: number;
}

export interface ClientInput {
  tipo_identificacion: "ruc" | "cedula" | "pasaporte";
  identificacion: string;
  razon_social: string;
  telefono: string;
  email: string;
  direccion: string;
  tipo_cliente: "regular" | "preferencial" | "mayorista";
}

/* =======================================================
   GET ALL CLIENTS FOR AN ENTITY
   ======================================================= */
export async function fetchClients(entityId: string): Promise<Client[]> {
  if (!entityId) return [];

  const colRef = collection(db, "entities", entityId, "clientes");
  const snapshot = await getDocs(colRef);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Client, "id">),
  }));
}

/* =======================================================
   CREATE CLIENT
   REGLAS FIRESTORE QUE DEBEMOS CUMPLIR:
   - request.resource.data.entityId == entityId
   - request.resource.data.userId == request.auth.uid
   ======================================================= */
export async function createClient(
    entityId: string, 
    data: Partial<Client>) {

    const auth = getAuth();
    const userId = auth.currentUser?.uid;

    if (!userId) throw new Error("Not authenticated");

    const newRef = doc(collection(db, "entities", entityId, "clientes"));
    const now = Date.now();

    const payload = {
        id: newRef.id,
        entityId: entityId,
        userId: userId,
        tipo_identificacion: data.tipo_identificacion!,
        identificacion: data.identificacion!,
        razon_social: data.razon_social!,
        telefono: data.telefono ?? "",
        email: data.email ?? "",
        direccion: data.direccion ?? "",
        tipo_cliente: data.tipo_cliente ?? "regular",
        createdAt: now,
        updatedAt: now,
    };

    await setDoc(newRef, payload);
    return payload;
}


/* =======================================================
   UPDATE CLIENT
   ======================================================= */
export async function updateClient(
  entityId: string,
  clientId: string,
  data: Partial<ClientInput>
) {
    const ref = doc(db, "entities", entityId, "clientes", clientId);

    await updateDoc(ref, {
        ...data,
        updatedAt: Date.now(),
    });
}

/* =======================================================
   DELETE CLIENT
   ======================================================= */
export async function deleteClient(entityId: string, clientId: string) {

    const ref = doc(db, "entities", entityId, "clientes", clientId);
    await deleteDoc(ref);
}