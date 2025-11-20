// src/types/InvoiceLayoutTypes.ts

export interface TextBlock {
  str: string;
  x: number;
  y: number;
}
export type EntrySource = "ai" | "manual" | "edited" | "vision";

export interface JournalEntry {
  id?: string;
  entityId?: string;
  userId?: string;
  transactionId?: string;

  date: string;
  description: string;

  account_code: string;
  account_name: string;

  debit?: number;
  credit?: number;

  type: "expense" | "income" | "liability";

  invoice_number: string;
  issuerRUC: string;
  issuerName: string;
  supplier_name: string;
  invoiceDate: string;
  entityRUC: string;

  source?: EntrySource;
  isManual?: boolean;
  createdAt?: number;
}