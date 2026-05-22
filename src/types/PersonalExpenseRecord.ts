// ============================================================================
// src/types/PersonalExpenseRecord.ts
// CONTILISTO — Persisted record for a personal-expense transaction.
//
// Personal expenses (tagged [Personal: Category] in the journal preview) are
// stored in a dedicated Firestore sub-collection  entities/{id}/personalExpenses
// so they NEVER touch journalEntries and therefore NEVER affect financial
// statements, tax ledgers, or account balances.
// ============================================================================

import type { SriCategoryKey } from "@/services/personalExpensesService";

export interface PersonalExpenseRecord {
  /** Firestore document id */
  id: string;
  entityId: string;
  uid: string;

  /** Links all Firestore docs that belong to the same journal transaction */
  transactionId: string;

  /** Original invoice/factura number (e.g. "003-001-000038329") */
  invoice_number: string;
  /** Normalized for duplicate-check queries */
  invoice_number_normalized: string;

  /** YYYY-MM-DD */
  date: string;

  /** SRI personal-expense category */
  category: SriCategoryKey;

  /** Description with the [Personal: X] tag stripped */
  description: string;

  supplierName: string;
  supplierRUC: string;

  /** Taxable base (5xx/6xx debit total, excl. IVA) */
  amount: number;
  /** IVA portion (133xxx debit total) */
  iva: number;
  /** amount + iva */
  total: number;

  createdAt: number;
}
