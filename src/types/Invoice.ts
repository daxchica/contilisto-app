// src/types/Invoice.ts

import type { InvoiceStatus } from "./InvoiceStatus";

/* ==============================
   ENUMS / UNIONS
============================== */

export type InvoiceType = "FACTURA";
export type TaxRate = 0 | 12 | 15;

export type identificationType = 
   | "ruc"
   | "cedula"
   | "pasaporte"
   | "consumidor_final";

/* ==============================
   CUSTOMER
============================== */

export interface InvoiceCustomer {
  contactId?: string;

  identificationType: "ruc" | "cedula" | "pasaporte";
  identification: string;
  name: string;

  email?: string;
  address?: string;
  phone?: string;
}

/* ==============================
   ITEMS
============================== */

export interface InvoiceItem {
  id: string; // uuid

  productCode?: string;

  description: string;

  quantity: number;
  unitPrice: number;

  /** descuento absoluto por línea */
  discount?: number;

  /** base imponible */
  subtotal: number;

  ivaRate: TaxRate;
  ivaValue: number;

  /** subtotal + iva */
  total: number;

  /** contabilidad automática */
  accountCode?: string;
}

/* ==============================
   TOTALS
============================== */

export interface InvoiceTotals {
  subtotalsByRate: Partial<Record<TaxRate, number>>;

  subtotalNoObjetoIVA: number;
  subtotalExentoIVA: number;
  subtotalSinImpuestos: number;

  discountTotal: number;
  ice: number;
  ivaByRate: Partial<Record<Exclude<TaxRate, 0>, number>>;
  irbpnr: number;
  propina: number;
  
  total: number;
}

/* ==============================
   SRI DATA
============================== */

export interface InvoiceSri {
   ambiente: "1" | "2"; // pruebas | producción

   estab: string;
   ptoEmi: string;
   secuencial: string;

   claveAcceso?: string;

   authorizationNumber?: string;
   authorizationDate?: string;

   xml?: string;
   xmlSigned?: string;

   sriResponse?: unknown;
   errors?: string[];
}

/* ==============================
   MAIN AGGREGATE
============================== */

export interface Invoice {
  /** Firestore doc id */
  id?: string;

  entityId: string;
  userId: string;

  type: InvoiceType;
  status: InvoiceStatus;

  /** YYYY-MM-DD */
  issueDate: string;
  dueDate?: string;

  customer: InvoiceCustomer;

  currency: "USD";

  items: InvoiceItem[];
  totals: InvoiceTotals;

  sri?: InvoiceSri;

  note?: string;
  relatedInvoiceId?: string;
  journalEntryId?: string;
  
  createdAt: number;
  updatedAt: number;

  issuedAt?: number;
  cancelledAt?: number;
  cancelReason?: string;
}