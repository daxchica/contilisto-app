export interface InvoicePreviewMetadata {
  invoiceType: "sale" | "expense";

  issuerRUC: string;
  issuerName: string;

  buyerName?: string;
  buyerRUC?: string;

  invoiceDate?: string;
  invoice_number?: string;
}