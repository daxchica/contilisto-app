// src/services/invoiceService.ts
import { db } from "@/firebase-config";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import type { Invoice } from "@/types/Invoice";

export async function createInvoice(
  entityId: string,
  data: Omit<Invoice, "id" | "entityId" | "createdAt" | "createdBy" | "status">
): Promise<Invoice> {
  const colRef = collection(db, "entities", entityId, "invoices");

  const docRef = await addDoc(colRef, {
    ...data,
    entityId,
    status: "draft",
    createdAt: Date.now(),
    createdBy: "system", // o uid del usuario autenticado
  });

  return {
    id: docRef.id,
    entityId,
    status: "draft",
    createdAt: Date.now(),
    createdBy: "system",
    ...data,
  };
}