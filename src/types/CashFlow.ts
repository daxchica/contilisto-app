// src/types/CashFlow.ts

export type CashFlowDirection = "in" | "out";

export interface CashFlowItem {
  entityId: string;
  invoiceId: string;
  invoiceNumber: string;

  partyName: string;
  partyRUC: string;

  dueDate: number; // timestamp (ms)
  amount: number;
  paidAmount: number;

  flowDirection: CashFlowDirection;
  currency: string;

  type: "AR" | "AP";
  status: "due" | "partial" | "paid" | "overdue";
}