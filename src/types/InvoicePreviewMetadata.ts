export interface InvoicePreviewMetadata {
  invoiceType: "sale" | "expense";

  invoice_number: string;
  invoiceDate: string;
  
  issuerRUC: string;
  issuerName: string;

  buyerName?: string;
  buyerRUC?: string;

  invoiceIdentitySource?: "sri-authorization";
}