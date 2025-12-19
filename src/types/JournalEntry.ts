// ============================================================================
// src/types/JournalEntry.ts
// Central accounting entry type — CONTILISTO v1.0
// ============================================================================

export type EntrySource = "ai" | "manual" | "edited" | "vision" | "initial";
export type JournalType = "expense" | "income" | "liability";

export interface JournalEntry {
  // Identifiers
  id?: string;
  entityId?: string;
  uid?: string;
  userId?: string;
  transactionId?: string;

  // Compatibility aliases (do not rely on these in new code)
  transaction_id?: string;

  // Core fields
  date: string; // YYYY-MM-DD
  description: string;

  // Chart of accounts
  account_code: string;
  account_name: string;

  // Amounts
  debit?: number;
  credit?: number;

  // Optional classification
  type?: JournalType;

  // Invoice metadata (optional)
  invoice_number?: string;
  issuerRUC?: string;
  issuerName?: string;
  supplier_name?: string;
  invoiceDate?: string;
  entityRUC?: string;

  // Traceability (Bank Book -> Journal)
  bankMovementId?: string; // links to entities/{entityId}/bankMovements/{bankMovementId}

  // Notes / UI
  comment?: string;

  // Source
  source?: EntrySource;
  isManual?: boolean;

  createdAt?: number;
}