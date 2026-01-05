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
    
    sri: {
      ambiente: data.sri?.ambiente ?? "1",
      estab: data.sri?.estab ?? "001",
      ptoEmi: data.sri?.ptoEmi ?? "001",
      secuencial: data.sri?.secuencial ?? "000000001",
    },
  };

  const colRef = collection(db, "entities", entityId, "invoices");

  const docRef = await addDoc(colRef, {
    ...invoiceToSave,
    createdAtTs: serverTimestamp(),
    updatedAtTs: serverTimestamp(),
  });

  return { ...invoiceToSave, id: docRef.id };
}

/* ============================================================
   ISSUE — Move from draft -> pending-sign
============================================================ */
export interface IssueInvoiceResponse {
  claveAcceso: string;
}

export async function issueInvoice(
  entityId: string,
  invoiceId: string
): Promise<IssueInvoiceResponse> {
  if (!entityId || !invoiceId) {
    throw new Error("entityId/invoiceId requeridos");
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 15_000);

  const res = await fetch("/.netlify/functions/issue-invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityId, invoiceId }),
    signal: controller.signal,
  });

  const text = await res.text();

  let data: IssueInvoiceResponse;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text);
  }

  if (!res.ok) {
    throw new Error((data as any)?.error || "Error emitiendo factura");
  }

  return data;
  }
  

/* ============================================================
   CANCEL — Cancel draft (or before SRI)
============================================================ */
export async function cancelInvoice(
  entityId: string,
  invoice: Invoice,
  reason: string
): Promise<void> {
  if (!entityId || !invoice?.id) {
    throw new Error("entityId/invoiceId requeridos");
  }

  assertInvoiceStatus(invoice, ["draft", "pending-sign"]);

  await updateDoc(
    doc(db, "entities", entityId, "invoices", invoice.id), 
    {
      status: "cancelled" as InvoiceStatus,
      cancelledAt: Date.now(),
      cancelReason: reason ?? "",
      updatedAt: Date.now(),
      updatedAtTs: serverTimestamp(),
    }
  );
}

/* ============================================================
   SEND TO SRI — Signed → Recepción
============================================================ */
export interface SendToSriResponse {
  claveAcceso: string;
  estado: "RECIBIDA" | "DEVUELTA";
  mensajes?: string[];
}

export async function sendInvoiceToSri(
  entityId: string,
  invoice: Invoice
): Promise<SendToSriResponse> {
  if (!entityId || !invoice?.id) {
    throw new Error("entityId / invoice requeridos");
  }

  assertInvoiceStatus(invoice, ["signed"]);

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 15_000);

  const res = await fetch("/.netlify/functions/send-invoice-to-sri", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityId, invoiceId: invoice.id }),
    signal: controller.signal,
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

/* ============================================================
   STATUS GUARD
============================================================ */
export function assertInvoiceStatus(
  invoice: Invoice,
  allowed: InvoiceStatus[]
) {
  if (!allowed.includes(invoice.status)) {
    throw new Error(
      `Acción no permitida en estado ${invoice.status}`
    );
  }
}
