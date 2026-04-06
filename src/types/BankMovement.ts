// ============================================================================
// src/types/BankMovement.ts
// CONTILISTO — BANK MOVEMENT TYPE (PRODUCTION READY)
// ============================================================================

export interface BankMovement {

  id?: string;

  entityId: string;

  // 🔹 ACCOUNTING LINK (CRITICAL)
  account_code: string;           // 🔥 REQUIRED for reconciliation

  bankAccountId: string;

  // 🔹 JOURNAL LINK (UNIFIED)
  transactionId: string;          // 🔥 MUST match JournalEntry.transactionId

  date: string;

  amount: number;                 // always positive

  // 🔹 DIRECTION (ACCOUNTING SAFE)
  direction: "in" | "out";

  // 🔹 TYPE (BUSINESS CONTEXT)
  type: 
    | "deposit"
    | "withdrawal"
    | "transfer"
    | "payment"
    | "collection";

  description?: string;

  // 🔹 RECONCILIATION LAYER
  statementId?: string;

  reconciliationStatus?: 
    | "pending"
    | "matched"
    | "manual";

  // 🔹 OPTIONAL FUTURE-PROOFING
  currency?: string;              // default: USD

  createdAt?: number;
}