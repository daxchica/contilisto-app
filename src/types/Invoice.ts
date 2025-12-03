// src/types/Invoice.ts
import { InvoiceItem } from "./InvoiceItem";

export interface Invoice {
  id: string;
  entityId: string;
  clientId: string;
  clientName: string;
  issueDate: number;
  items: InvoiceItem[];
  subtotal: number;
  iva: number;
  total: number;
  status: "draft" | "sent" | "authorized" | "rejected";
  sriAccessKey?: string;
  xmlSigned?: string;
}