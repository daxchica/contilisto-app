// src/types/receivable.ts
import type { Installment, InstallmentStatus } from "@/types/Payable";

export type ReceivableStatus = "pending" | "partial" | "paid" | "inactive";

export interface Receivable {
  id?: string;
  entityId: string;

  transactionId?: string;
  invoiceNumber: string;

  // Customer (mirror of supplier)
  customerName?: string;
  customerRUC: string;

  // Receivable control account
  account_code: string;   // 10102050101
  account_name: string;

  issueDate: string;      // YYYY-MM-DD
  dueDate?: string;

  termsDays: number;
  installments: number;

  total: number;
  paid: number;
  balance: number;

  status: ReceivableStatus;

  installmentSchedule?: Installment[];

  createdFrom: "ai_journal" | "manual_journal" | "sri_invoice";

  createdAt?: any; // serverTimestamp
  updatedAt?: any;
}