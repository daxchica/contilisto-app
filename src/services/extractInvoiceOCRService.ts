// src/services/extractInvoiceOCRService.ts

export type OCRInvoiceResult = {
    success: boolean;

    invoiceIdentitySource?: "sri-authorization";

    invoiceType: "expense" | "sale";
    entries: any[];
    issuerRUC?: string;
    issuerName?: string;
    buyerName?: string;
    buyerRUC?: string;
    invoiceDate?: string;
    invoice_number?: string;
    __source?: "ocr";
};

export async function extractInvoiceOCR(
  _base64: string
): Promise<OCRInvoiceResult> {
  return {
    success: false,
    invoiceType: "expense",
    entries: [],
    __source: "ocr",
  };
}