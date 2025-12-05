// src/types/Invoice.ts
import type { InvoiceItem } from "./InvoiceItem";

export type InvoiceType = "invoice" | "credit-note" | "retention";

export type InvoiceStatus = 
  | "draft"
  | "pending-sri" 
  | "authorized" 
  | "rejected";

export interface Invoice {
  id: string;
  entityId: string;

  clientId: string;
  clientName: string;

  issueDate: string;
  dueDate?: string;

  invoiceType: InvoiceType;

  items: InvoiceItem[];

  subtotal: number;
  iva: number;
  total: number;

  status: InvoiceStatus;

  sriXml?: string;   
  sriAccessKey?: string;
  xmlSigned?: string;

  authorizationDate?: string;

  sriAuthNumber?: string;

  createdAt: number;
  createdBy: string;
}