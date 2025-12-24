// ============================================================================
// src/services/invoiceService.ts
// MVP: creación y almacenamiento de facturas en Firestore (estado "draft").
// La firma y envío al SRI se hará luego desde una Netlify Function / backend.
// ============================================================================

import { db } from "@/firebase-config";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import type { Invoice } from "@/types/Invoice";

/**
 * Crea una factura en estado "draft" para una empresa (entityId).
 * No firma ni envía al SRI: eso se hará en una fase 2 desde backend.
 */
export async function createInvoice(
  entityId: string,
  data: Omit<
    Invoice,
    "id" | "entityId" | "createdAt" | "createdBy" | "status"
  >
): Promise<Invoice> {
  if (!entityId) {
    throw new Error("entityId es requerido para crear la factura");
  }

  const colRef = collection(db, "entities", entityId, "invoices");

  const now = Date.now();

  const docRef = await addDoc(colRef, {
    ...data,
    entityId,
    status: "draft",        // aún no enviada al SRI
    createdAt: serverTimestamp(), // timestamp del servidor
    createdBy: "system",
  });

  // Devolvemos un objeto Invoice usable en el frontend.
  // createdAt lo ponemos en "now" para no depender del serverTimestamp.
  return {
    id: docRef.id,
    entityId,
    status: "draft",
    createdAt: now,
    createdBy: "system",
    ...data,
  } as Invoice;
}

export async function issueInvoice(
  entityId: string,
  invoiceId: string
): Promise<void> {
  const ref = doc(db, "entities", entityId, "invoices", invoiceId);

  await updateDoc(ref, {
    status: "issued",
    issuedAt: Date.now(), // opcional pero recomendado
  });
}

export async function cancelInvoice(
  entityId: string,
  invoiceId: string,
  reason?: string
): Promise<void> {
  const ref = doc(db, "entities", entityId, "invoices", invoiceId);

  await updateDoc(ref, {
    status: "cancelled",
    cancelledAt: Date.now(),
    cancelReason: reason ?? null,
  });
}