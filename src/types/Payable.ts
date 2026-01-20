// src/types/payable.ts
export type PayableStatus = "pending" | "partial" | "paid" | "inactive";

export type InstallmentStatus = "pending" | "partial" | "paid";

export interface Installment {
  index: number;        // 1,2,3...
  dueDate: string;      // YYYY-MM-DD
  amount: number;       // valor cuota
  paid: number;         // pagado a esta cuota
  balance: number;      // saldo de esta cuota
  status: InstallmentStatus;
}

export interface Payable {
  id?: string;
  entityId: string;
  
  transactionId?: string;
  invoiceNumber: string;

  supplierName?: string;
  supplierRUC?: string;

  account_code: string;
  account_name: string;

  issueDate: string;     // "YYYY-MM-DD"
  dueDate?: string;

  termsDays: number;
  installments: number;

  total: number;
  paid: number;
  balance: number;

  status: PayableStatus;

  installmentSchedule?: Installment[];

  createdFrom: "ai_journal" | "manual_journal" | "sri_invoice";

  createdAt?: any; // serverTimestamp
  updatedAt?: any;

}