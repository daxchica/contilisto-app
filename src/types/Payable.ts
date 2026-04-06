// ============================================================================
// src/types/payable.ts
// CONTILISTO — Accounts Payable Type (PRODUCTION READY)
// ============================================================================

import { Timestamp } from "firebase/firestore";

// ----------------------------------------------------------------------------
// STATUS
// ----------------------------------------------------------------------------

export type PayableStatus = "pending" | "partial" | "paid" | "inactive";

export type InstallmentStatus = "pending" | "partial" | "paid";

// ----------------------------------------------------------------------------
// INSTALLMENTS
// ----------------------------------------------------------------------------

export interface Installment {
  index: number;        // 1,2,3...
  dueDate: string;      // YYYY-MM-DD
  amount: number;       // valor cuota
  paid: number;         // pagado a esta cuota
  balance: number;      // saldo de esta cuota
  status: InstallmentStatus;
}

// ----------------------------------------------------------------------------
// PAYMENT TRACKING (🔥 NEW — REQUIRED)
// ----------------------------------------------------------------------------

export interface PayablePayment {
  transactionId: string;   // journal transaction of the payment
  amountApplied: number;   // total impact on payable
  cashPaid: number;        // actual cash out
  retentionIR: number;
  retentionIVA: number;
  paymentDate: string;     // YYYY-MM-DD
  certificate: string;     // retention certificate (optional)
  createdBy: string;
  createdAt: number;       // Date.now()
}

// ----------------------------------------------------------------------------
// PAYABLE
// ----------------------------------------------------------------------------

export interface Payable {
  id?: string;

  entityId: string;

  // 🔥 MUST NOT BE OPTIONAL
  transactionId: string;

  // DOCUMENT
  invoiceNumber: string;
  invoiceNumberNormalized: string;

  supplierId?: string;
  supplierName?: string;
  supplierRUC?: string;

  // ACCOUNTING
  account_code: string;
  account_name: string;

  // DATES
  issueDate: string;       // YYYY-MM-DD
  dueDate?: string;

  termsDays?: number;
  installments: number;

  currency?: string;

  // AMOUNTS
  total: number;
  paid: number;
  balance: number;

  status: PayableStatus;

  // INSTALLMENTS
  installmentSchedule?: Installment[];

  // 🔥 PAYMENT TRACKING (NEW)
  paymentTransactionIds?: string[];
  payments?: PayablePayment[];

  // TRACEABILITY
  createdFrom:
    | "ai_journal"
    | "manual_journal"
    | "sri_invoice"
    | "journal_rebuild";

  // FIRESTORE
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}