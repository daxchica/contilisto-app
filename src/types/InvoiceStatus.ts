// src/types/InvoiceStatus.ts
export type InvoiceStatus =
  | "draft"
  | "pending-sign"
  | "signed"
  | "sent-sri"
  | "authorized"
  | "rejected"
  | "cancelled"
  | "voided"; // para anular ya autorizado (SRI)