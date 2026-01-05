// ============================================================================
// extractInvoiceVisionService.ts — CONTILISTO v1.0
// Servicio frontend que llama a la Netlify Function
// ============================================================================

export interface ExtractedInvoiceResponse {
  success: boolean;
  issuerRUC: string;
  issuerName: string;
  buyerRUC?: string;
  buyerName?: string;
  invoiceDate: string;
  invoice_number: string;
  subtotal15: number;
  subtotal0: number;
  iva: number;
  total: number;
  concepto: string;
  type: string;
  ocrText: string;
  recommendedAccounts: any[];
  entries: any[];
}

export async function extractInvoiceVision(
  base64: string,
  userRUC: string,
  entityType: string
): Promise<ExtractedInvoiceResponse> {
  try {
    const res = await fetch("/api/extract-invoice-vision", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        base64,
        userRUC,
        entityType
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Error del servidor Vision OCR: ${text}`);
    }

    const data = await res.json();

    if (!data.success) {
      throw new Error(
        data.error || "Error desconocido procesando la factura."
      );
    }

    return data as ExtractedInvoiceResponse;

  } catch (err: any) {
    console.error("❌ extractInvoiceVisionService ERROR:", err);
    throw new Error(err.message || "Error procesando factura.");
  }
}