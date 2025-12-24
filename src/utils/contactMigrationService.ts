// src/services/contactMigrationService.ts
import {
  collection,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { db } from "@/firebase-config";

function normalize(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export async function migrateClientesToContactsOnce(entityId: string) {
  const clientesRef = collection(db, "entities", entityId, "clientes");
  const contactsRef = collection(db, "entities", entityId, "contacts");

  const clientesSnap = await getDocs(clientesRef);
  const contactsSnap = await getDocs(contactsRef);

  // 🔐 Índice en memoria para evitar duplicados
  const existingIds = new Set(
    contactsSnap.docs
      .map((d) => d.data().identification)
      .filter(Boolean)
      .map(normalize)
  );

  let migrated = 0;

  for (const docSnap of clientesSnap.docs) {
    const c = docSnap.data();

    if (!c.identification) continue;

    const normalizedId = normalize(c.identificacion);

    if (existingIds.has(normalizedId)) {
      console.log("⏭️ Ya existe, se omite:", c.identificacion);
      continue;
    }

    await addDoc(contactsRef, {
      role: "cliente",
      identificationType: c.tipo_identification ?? "cedula",
      identification: c.identification,
      identificationNormalized: normalizedId,
      name: c.name ?? "",
      email: c.email ?? "",
      address: c.direccion ?? "",
      phone: c.telefono ?? "", // nunca undefined
      activo: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    existingIds.add(normalizedId);
    migrated++;
  }

  console.log(`✅ Migración completada: ${migrated} contactos`);
}