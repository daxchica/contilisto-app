// src/services/invoiceService.ts
import { db } from "@/firebase-config";
import {
  addDoc,
  collection,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import type { Invoice } from "@/types/Invoice";
import type { InvoiceStatus } from "@/types/InvoiceStatus";


/* ============================================================
   INPUT TYPE — what the UI is allowed to send
============================================================ */
export type CreateInvoiceInput = Omit<
  Invoice,
  | "id"
  | "entityId"
  | "userId"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "issuedAt"
  | "cancelledAt"
  | "cancelReason"
>;

/* ============================================================
   CREATE — Draft Invoice
   Recommended signature:
   createInvoice(entityId, userId, payload)
============================================================ */
export async function createInvoice(
  entityId: string,
  userId: string,
  data: CreateInvoiceInput
): Promise<Invoice> {
  if (!entityId) throw new Error("entityId requerido");
  if (!userId) throw new Error("userId requerido");

  const now = Date.now();

  const invoiceToSave: Omit<Invoice, "id"> = {
    ...data,
    entityId,
    userId,
    status: "draft",
    createdAt: now,
    updatedAt: now,

    // Defaults SRI draft (luego se asigna real al emitir)
    sri: data.sri ?? {
      ambiente: "1",
      estab: "001",
      ptoEmi: "001",
      secuencial: "000000001",
    },
  };

  const colRef = collection(db, "entities", entityId, "invoices");
  const docRef = await addDoc(colRef, {
    ...invoiceToSave,
    // si quieres timestamp Firestore además del number:
    createdAtTs: serverTimestamp(),
    updatedAtTs: serverTimestamp(),
  });

  return { ...invoiceToSave, id: docRef.id };
}

/* ============================================================
   ISSUE — Move from draft -> pending-sign
   (La firma p12 NO debe estar en el front)
============================================================ */
export async function issueInvoice(
  entityId: string,
  invoiceId: string
): Promise<void> {
  if (!entityId || !invoiceId) throw new Error("entityId/invoiceId requeridos");

  await updateDoc(doc(db, "entities", entityId, "invoices", invoiceId), {
    status: "pending-sign" as InvoiceStatus,
    issuedAt: Date.now(),
    updatedAt: Date.now(),
    updatedAtTs: serverTimestamp(),
  });
}

/* ============================================================
   CANCEL — Cancel draft (or before SRI)
============================================================ */
export async function cancelInvoice(
  entityId: string,
  invoiceId: string,
  reason: string
): Promise<void> {
  if (!entityId || !invoiceId) throw new Error("entityId/invoiceId requeridos");

  await updateDoc(doc(db, "entities", entityId, "invoices", invoiceId), {
    status: "cancelled" as InvoiceStatus,
    cancelledAt: Date.now(),
    cancelReason: reason ?? "",
    updatedAt: Date.now(),
    updatedAtTs: serverTimestamp(),
  });
}


export async function sendInvoiceToSri(
  entityId: string,
  invoiceId: string
): Promise<SendToSriResponse> {
  const res = await fetch("/.netlify/functions/send-invoice-to-sri", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityId, invoiceId }),
  });

  const text = await res.text();

  let data: SendToSriResponse;
  
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text);
  }
  
  if (!res.ok) {
    throw new Error((data as any)?.error || "Error enviando factura al SRI");
  }

  return data;
}


export interface SendToSriResponse {
  claveAcceso: string;
  estado: "RECIBIDA" | "DEVUELTA";
  mensajes?: string[];
}