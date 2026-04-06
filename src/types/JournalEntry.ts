// ============================================================================
// src/types/JournalEntry.ts
// Central accounting entry type — CONTILISTO v2.0 (PRODUCTION SAFE)
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

// ============================================================================
// CORE TRANSACTION TYPES (MANDATORY)
// ============================================================================

export type TransactionType = "invoice" | "payment" | "transfer";

export type DocumentNature = "sale" | "purchase";

// ============================================================================
// JOURNAL ENTRY
// ============================================================================

export interface JournalEntry {
  // --------------------------------------------------------------------------
  // IDENTIFIERS
  // --------------------------------------------------------------------------
  id?: string;
  entityId: string;

  uid?: string;
  userIdSafe?: string;

  // 🔴 REQUIRED — backbone of accounting system
  transactionId: string;

  // 🔴 REQUIRED — defines behavior (AP / AR / BANK)
  transactionType: TransactionType;

  // 🔴 REQUIRED — defines business meaning (SALE vs PURCHASE)
  documentNature: DocumentNature;

  // Optional: link to normalized document registry
  documentId?: string;

  // Compatibility alias (legacy)
  transaction_id?: string;

  // --------------------------------------------------------------------------
  // CORE DATA
  // --------------------------------------------------------------------------
  date: string; // YYYY-MM-DD
  description: string;

  // --------------------------------------------------------------------------
  // CHART OF ACCOUNTS
  // --------------------------------------------------------------------------
  account_code: string;
  account_name: string;

  // --------------------------------------------------------------------------
  // AMOUNTS
  // --------------------------------------------------------------------------
  debit?: number;
  credit?: number;

  // --------------------------------------------------------------------------
  // DOCUMENT / INVOICE METADATA
  // --------------------------------------------------------------------------
  invoice_number?: string;
  invoice_number_normalized?: string;
  documentRef?: string;

  issuerRUC?: string;
  issuerName?: string;

  supplier_name?: string;
  supplier_ruc?: string;

  customer_name?: string;
  customerRUC?: string;
  customer_ruc?: string;

  buyerRUC?: string;
  entityRUC?: string;

  invoiceDate?: string;

  // --------------------------------------------------------------------------
  // BANK TRACEABILITY
  // --------------------------------------------------------------------------
  bankMovementId?: string;

  // --------------------------------------------------------------------------
  // UI / NOTES
  // --------------------------------------------------------------------------
  comment?: string;

  // --------------------------------------------------------------------------
  // SOURCE
  // --------------------------------------------------------------------------
  source?: EntrySource;
  isManual?: boolean;

  // --------------------------------------------------------------------------
  // TIMESTAMPS
  // --------------------------------------------------------------------------
  createdAt?: number;
  updatedAt?: number;

  // --------------------------------------------------------------------------
  // TAX INFORMATION (SRI / ATS / IVA)
  // --------------------------------------------------------------------------
  tax?: {
    // ================================
    // DOCUMENT (SRI CORE)
    // ================================
    document?: {
      type?: string;              // "01" invoice, "04" credit note
      authorization?: string;     // clave de acceso (49 digits)
      establishment?: string;     // 001
      emissionPoint?: string;     // 002
      sequential?: string;        // 000000123
    };

    // ================================
    // SUPPLIER / CUSTOMER (ATS)
    // ================================
    supplier?: {
      ruc?: string;
      name?: string;
      identificationType?: string; // "04" RUC, "05" cedula
    };

    // ================================
    // PAYMENT (ATS)
    // ================================
    payment?: {
      method?: string; // formaPago SRI
    };

    // ================================
    // TAX BASES
    // ================================
    bases?: Array<{
      rate: number;   // 0, 12, 15
      base: number;
      iva?: number;
    }>;

    // ================================
    // ICE
    // ================================
    ice?: number;

    // ================================
    // TOTAL
    // ================================
    total?: number;

    // ================================
    // RETENTIONS (SRI STRUCTURE)
    // ================================
    retenciones?: Array<{
      taxType: "IVA" | "RENTA";

      code: string;        // codRetencion
      percentage: number;  // porcentajeRetener

      base: number;        // baseImponible
      amount: number;      // valorRetenido
    }>;
  };
}