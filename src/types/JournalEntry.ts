// ============================================================================
// src/types/JournalEntry.ts
// Central accounting entry type — CONTILISTO v1.0
// ============================================================================


export type EntrySource = 
  | "vision"
  | "ocr"
  | "ai" 
  | "manual" 
  | "learned"
  | "edited" 
  | "initial"
  | "normalized-sale"
  | "normalized-expense"
  | "placeholder";
  
export type JournalType = "expense" | "income" | "liability";

export interface JournalEntry {
  // Identifiers
  id?: string;
  entityId: string;
  uid?: string;
  userIdSafe?: string;
  transactionId?: string;

  // NEW: link journal entry to normalized business document
  documentId?: string;

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
  invoice_number_normalized?: string;
  documentRef?: string;
  
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
  updatedAt?: number;

  customer_name?: string;
  customerRUC?: string;

  // --------------------------------------------------------------------------
  // TAX INFORMATION (SRI / ATS / IVA)
  // --------------------------------------------------------------------------

  tax?: {

    // VAT classification
    taxCode?: string;          // IVA12, IVA0, ICE, etc.

    // SRI document info
    documentType?: string;     // 01 invoice, 04 credit note, etc.
    authorizationNumber?: string;

    // Payment information
    paymentMethod?: string;    // ATS formaPago

    // Tax bases
    base12?: number;
    base0?: number;
    iva?: number;
    ice?: number;

    // Retentions
    retenciones?: Array<{
      taxType: "IVA" | "RENTA";
      code: string;
      percentage: number;
      base: number;
      amount: number;
    }>;
  };
}