// src/types/Invoice.ts

import type { InvoiceItem } from "./InvoiceItem";

export type IdentificationType =
  | "ruc"
  | "cedula"
  | "pasaporte"
  | "consumidor_final";

/* ===============================
   SNAPSHOT DEL CONTACTO
   (inmutable, para SRI y auditoría)
================================ */
export interface InvoiceContactSnapshot {
  name: string;
  identification: string;
  identificationType: IdentificationType;
  email: string;
  address: string;
  phone?: string;
}

/* ===============================
   TOTALES DE FACTURA
================================ */
export interface InvoiceTotals {
  subtotal0: number;
  subtotal12: number;
  descuento: number;
  iva: number;
  total: number;

  taxes?: {
    code: "iva";
    rate: 12;
    base: number;
    amount: number;
  }[];
}

/* ===============================
   FACTURA
================================ */
export interface Invoice {
  id: string;
  entityId: string;

  /* ===== Identificación ===== */
  invoiceType: "invoice" | "credit-note" | "retention";
  sequential?: string; // puede estar vacío en borrador
  issueDate: string;
  dueDate?: string;

  /* ===== Comprador ===== */
  contactId: string;
  contactSnapshot: InvoiceContactSnapshot;

  /* ===== Detalle ===== */
  currency: "USD";
  items: InvoiceItem[];
  totals: InvoiceTotals;

  /* ===== Estado ===== */
  status: "draft" | "issued" | "cancelled";

  /* ===== Auditoría ===== */
  createdAt: number;
  createdBy: string;
}