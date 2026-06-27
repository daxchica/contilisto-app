// src/types/InvoicePreviewMetadata.ts

export interface InvoicePreviewMetadata {
  invoiceType: "sale" | "expense";

  invoice_number?: string;
  invoiceDate?: string;
  authorizationNumber?: string;
  /** For retentions: the related sales invoice number being retained on */
  relatedInvoiceNumber?: string;
  
  issuerRUC?: string;
  issuerName?: string;

  buyerName?: string;
  buyerRUC?: string;

  invoiceIdentitySource?: "sri-authorization";
}