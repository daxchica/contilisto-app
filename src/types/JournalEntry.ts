// ============================================================================
// src/types/JournalEntry.ts
// Tipo central de asiento contable — ARQUITECTURA CONTILISTO v1.0
// ============================================================================

export type EntrySource = "ai" | "manual" | "edited" | "vision";

export type JournalType = "expense" | "income" | "liability";

export interface JournalEntry {
  // Identificadores
  id?: string;
  entityId?: string;
  userId?: string;
  transactionId?: string;

  // Datos básicos
  date: string;
  description: string;

  // Cuenta contable
  account_code: string;
  account_name: string;

  // Montos
  debit?: number;
  credit?: number;

  // Tipo de asiento (puede venir vacío y se infiere luego)
  type?: JournalType;

  // Metadata de factura (opcionales para evitar errores TS)
  invoice_number?: string;
  issuerRUC?: string;
  issuerName?: string;
  supplier_name?: string;
  invoiceDate?: string;
  entityRUC?: string;

  // Origen del asiento
  source?: EntrySource;
  isManual?: boolean;

  createdAt?: number;
}