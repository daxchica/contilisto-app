import { getContextualAccountHint } from "./firestoreHintsService";

// ============================================================================
// extractInvoiceVisionService.ts — CONTILISTO (STABLE)
// Frontend service calling Vision OCR Netlify Function
// ============================================================================

export interface ExtractedInvoiceResponse {
  success: boolean;
  invoiceType: "sale" | "expense";

  issuerRUC: string;
  issuerName: string;

  buyerName?: string;
  buyerRUC?: string;

  invoiceDate?: string;
  invoice_number?: string;

  // Optional (Vision OCR may not return them)
  subtotal15?: number;
  subtotal0?: number;
  iva?: number;
  total?: number;

  concepto?: string;
  ocr_text?: string;

  entries: any[];
}

export async function extractInvoiceVision(
  base64: string,
  userRUC: string,
  uid: string
): Promise<ExtractedInvoiceResponse> {
  try {
    const res = await fetch("/.netlify/functions/extract-invoice-vision", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base64,
        userRUC,
        uid,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Vision OCR server error: ${text}`);
    }

    const data = await res.json();

    if (!data?.success) {
      throw new Error(
        data?.error || "Vision OCR failed to process invoice."
      );
    }

    // ------------------------------------------------------------------------
    // 🧠 CONTEXTUAL LEARNING (EXPENSE ONLY)
    // ------------------------------------------------------------------------

    if (
      data.invoiceType === "expense" &&
      data.issuerRUC &&
      data.concepto &&
      Array.isArray(data.entries)
    ) {
      try {
        const hint = await getContextualAccountHint(
          data.issuerRUC,
          data.concepto
        );

        if (hint) {
          data.entries = data.entries.map((e: any) => {
            const debit = Number(e.debit ?? 0);

            // Never override IVA or Proveedores
            if (
              debit > 0 &&
              e.account_code &&
              !e.account_code.startsWith("133") && // IVA
              !e.account_code.startsWith("201")    // Proveedores
            ) {
              return {
                ...e,
                account_code: hint.accountCode,
                account_name: hint.accountName,
                source: "learned",
              };
            }

            return e;
          });
        }
      } catch (err) {
        console.warn("⚠️ Contextual learning skipped:", err);
      }
    }

    // ------------------------------------------------------------------------
    // Normalize descriptions (non-destructive)
    // ------------------------------------------------------------------------

    if (Array.isArray(data.entries)) {
      data.entries = data.entries.map((e: any) => ({
        ...e,
        description:
          e.description ??
          data.concepto ??
          data.invoice_number ??
          "",
      }));
    }

    return data as ExtractedInvoiceResponse;
  } catch (err: any) {
    console.error("❌ extractInvoiceVisionService ERROR:", err);
    throw new Error(err.message || "Error processing invoice.");
  }
}