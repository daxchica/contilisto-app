// ============================================================================
// src/types/AccountingDocument.ts
// CONTILISTO — Normalized business document registry type
// ============================================================================

export type AccountingDocumentType =
  | "sales_invoice"
  | "purchase_invoice"
  | "retention"
  | "credit_note"
  | "debit_note"
  | "bank_movement"
  | "manual";

export type AccountingDocumentSource = "ai" | "manual" | "imported";

export type AccountingDocumentStatus = "draft" | "confirmed" | "cancelled";

export interface AccountingDocumentTaxRetention {
  taxType: "IVA" | "RENTA";
  code: string;
  percentage: number;
  base: number;
  amount: number;
}

export interface AccountingDocument {
  id: string;
  entityId: string;

  type: AccountingDocumentType;
  source: AccountingDocumentSource;
  status: AccountingDocumentStatus;

  issueDate: string; // YYYY-MM-DD
  period: string; // YYYY-MM

  documentNumber?: string;
  authorizationNumber?: string;

  counterpartyName?: string;
  counterpartyRUC?: string;

  subtotal12?: number;
  subtotal0?: number;
  iva?: number;
  ice?: number;
  total?: number;

  paymentMethod?: string;
  currency?: string;

  journalEntryIds?: string[];

  createdAt?: number;
  updatedAt?: number;

  retenciones?: AccountingDocumentTaxRetention[];

  notes?: string;
}