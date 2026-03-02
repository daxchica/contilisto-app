// src/types/bankTypes.ts

import type { Timestamp } from "firebase/firestore";


/* ============================================================================
 * Bank Account
 * ========================================================================== */
export interface BankAccount {
  id?: string;
  entityId: string;

  account_code?: string;
  accountCode?: string;

  code: string;
  parentCode: string;
  
  name: string;

  currency: string;
  createdBy?: string;
  number?: string;
  bankName?: string;
}

/* ============================================================================
 * Bank Movement Types
 * ========================================================================== */

export type BankMovementType = "in" | "out" | "transfer";

/* ============================================================================
 * Bank Movement (Source of Truth)
 * ========================================================================== */
export interface BankMovement {
  id?: string;
  entityId: string;

  bankAccountId: string;

  date: string;
  amount: number;
  type: BankMovementType;
  
  payee?: string;
  description?: string;
  reference?: string;

  relatedInvoiceId?: string;
  relatedJournalTransactionId?: string;
  
  reconciled?: boolean;
  reconciledAt?: Timestamp;
  
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;

  transfer?: TransferMeta;
  
  reconciliationBatchId?: string;
}

/* ============================================================================
 * Bank Book View Model
 * ========================================================================== */
export interface BankBookEntry {
  id: string;
  bankAccountId: string;
  date: string;
  amount: number;
  type: BankMovementType;
  payee?: string;
  description?: string;
  status: "Conciliado" | "Pendiente";
  relatedTo?: "accountsPayable" | "expense";
  linkedDocumentId?: string;
}

/* ===============================
 * Bank inter-bank transfers
 * ================================*/
export interface TransferMeta {
  transferId: string;
  fromAccountCode: string;
  toAccountCode: string;
}
