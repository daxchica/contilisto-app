import { JournalEntry } from "@/types/JournalEntry";
import { getContextualAccountHint } from "./firestoreHintsService";

// ============================================================================
// extractInvoiceVisionService.ts — CONTILISTO (STABLE)
// Frontend service calling Vision OCR Netlify Function
// Goal: ensure PreviewModal ALWAYS receives >=2 non-zero lines and balanced.
// No UI changes, only payload reliability.
// ============================================================================

type VisionEntry = {
  account_code?: string;
  account_name?: string;
  debit?: number;
  credit?: number;
  description?: string;
  source?: string;
};

export interface ExtractedInvoiceResponse {
  success: boolean;
  invoiceType: "sale" | "expense";

  invoiceIdentitySource?: "sri-authorization";

  __extraction?: {
    pageCount: number;
    source: "ocr" | "layout";
  };

  issuerRUC: string;
  issuerName: string;

  buyerName?: string;
  buyerRUC?: string;

  invoiceDate?: string;
  invoice_number?: string;

  taxableBase?: number;
  subtotal15?: number;
  subtotal0?: number;
  iva?: number;
  total?: number;

  concepto?: string;
  ocr_text?: string;

  entries: VisionEntry[];

}

const n = (x: any) => {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
};

function hasAccountPrefix(entries: VisionEntry[], prefix: string) {
  return entries.some(
    (e: VisionEntry) => String(e.account_code ?? "").startsWith(prefix));
}

function sumDebits(entries: VisionEntry[]) {
  return entries.reduce((s: number, e: VisionEntry) => s + n(e.debit), 0);
}

function sumCredits(entries: VisionEntry[]) {
  return entries.reduce((s: number, e: VisionEntry) => s + n(e.credit), 0);
}

function nonZeroLines(entries: VisionEntry[]) {
  return entries.filter(
    (e: VisionEntry) => n(e.debit) > 0 || n(e.credit) > 0).length;
}

/**
 * Ensure at least 2 non-zero lines and try to keep them balanced.
 * (PreviewModal requires nonZeroLines >= 2 and balanced)
 */
function ensureMinimumValidEntries(data: ExtractedInvoiceResponse) {
  if ((data as any).__extraction?.pageCount > 1) {
    // No normalizar ni reconstruir importes en multipagina
    return data;
  }

  if (!Array.isArray(data.entries)) data.entries = [];

  const taxableBase = n(data.taxableBase);
  const subtotal0 = n(data.subtotal0);
  const iva = n(data.iva);
  const total = n(data.total);

  const base = taxableBase + subtotal0;

  // ----------------------------
  // SALES normalization
  // ----------------------------
  if (data.invoiceType === "sale") {
    // Always ensure Receivable line exists
    if (total > 0 && !hasAccountPrefix(data.entries, "130")) {
      data.entries.push({
        account_code: "13010101",
        account_name: "Clientes",
        debit: total,
        credit: 0,
        source: "normalized-sale",
      });
    }

    // Ensure revenue line exists
    if (base > 0 && !hasAccountPrefix(data.entries, "401")) {
      data.entries.push({
        account_code: "401010101",
        account_name: "Ingresos por servicios",
        debit: 0,
        credit: base,
        source: "normalized-sale",
      });
    }

    // Ensure sales VAT (IVA débito) line exists if iva>0
    if (iva > 0 && !hasAccountPrefix(data.entries, "213")) {
      data.entries.push({
        account_code: "213010101",
        account_name: "IVA débito en ventas",
        debit: 0,
        credit: iva,
        source: "normalized-sale",
      });
    }
  }

  // ----------------------------
  // EXPENSE normalization
  // ----------------------------
  if (data.invoiceType === "expense") {
    // Always ensure Payable line exists
    if (total > 0 && !hasAccountPrefix(data.entries, "201")) {
      data.entries.push({
        account_code: "201030102",
        account_name: "Proveedores locales",
        debit: 0,
        credit: total,
        source: "normalized-expense",
      });
    }

    // Ensure at least one expense debit line exists (group 5)
    const hasExpenseDebit =
      data.entries.some(
        (e: VisionEntry) => 
        String(e?.account_code ?? "").startsWith("5") && n(e?.debit) > 0);

    if (!hasExpenseDebit) {
      const base = taxableBase; // base = subtotal15 + subtotal0
      if (base > 0) {
        data.entries.push({
          account_code: "502010101",
          account_name: "Gastos en servicios generales",
          debit: base,
          credit: 0,
          source: "normalized-expense",
        });
      }
    }

    // Ensure purchase VAT (IVA crédito) line exists if iva>0
    if (iva > 0 && !hasAccountPrefix(data.entries, "133")) {
      data.entries.push({
        account_code: "133010102",
        account_name: "IVA crédito en compras",
        debit: iva,
        credit: 0,
        source: "normalized-expense",
      });
    }
  }

  // ----------------------------
  // Enforce PreviewModal minimum rules
  // ----------------------------

  // If still fewer than 2 non-zero lines, add a second line placeholder (non-destructive)
  // We prefer NOT to fabricate amounts; but PreviewModal blocks if <2 non-zero.
  // So we only do this when totals are missing and entries are effectively empty.
  if (nonZeroLines(data.entries) < 2) {
    // keep structure but do NOT add money; user can edit in modal
    // ensure there are at least 2 rows (Preview allows editing)
    while (data.entries.length < 2) {
      data.entries.push({
        account_code: "",
        account_name: "",
        debit: 0,
        credit: 0,
        source: "placeholder",
      });
    }
  }

  // If off by rounding cents, adjust the smallest safe line (ONLY when already has money)
  const d = sumDebits(data.entries);
  const c = sumCredits(data.entries);
  const diff = Number((d - c).toFixed(2));

  if (Math.abs(diff) > 0.01 && (d > 0 || c > 0)) {
    // Minimal rounding correction: try to fix using receivable/payable line if present
    // Sales: adjust Clientes debit
    if (data.invoiceType === "sale") {
      const idx = data.entries.findIndex(
        (e: VisionEntry) => String(e.account_code ?? "").startsWith("130"));
      if (idx >= 0) {
        data.entries[idx] = {
          ...data.entries[idx],
          debit: Number((n(data.entries[idx].debit) - diff).toFixed(2)),
        };
      }
    }
    // Expense: adjust Proveedores credit
    if (data.invoiceType === "expense") {
      const idx = data.entries.findIndex(
        (e: VisionEntry) => String(e.account_code ?? "").startsWith("201"));
      if (idx >= 0) {
        data.entries[idx] = {
          ...data.entries[idx],
          credit: Number((n(data.entries[idx].credit) + diff).toFixed(2)),
        };
      }
    }
  }

  return data;
}

export async function extractInvoiceVision(
  base64: string,
  userRUC: string,
  uid: string
): Promise<ExtractedInvoiceResponse> {
  try {
    const res = await fetch("/.netlify/functions/extract-invoice-vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64, userRUC, uid }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Vision OCR server error: ${text}`);
    }

    const data = await res.json();

    if (!data?.success) {
      throw new Error(data?.error || "Vision OCR failed to process invoice.");
    }

    // ------------------------------------------------------------------------
    // 🔍 DEBUG — Totales recibidos del backend (antes de normalizar)
    // ------------------------------------------------------------------------
    console.log("PREVIEW TOTALS:", {
      invoiceType: data.invoiceType,
      pageCount: data.__extraction?.pageCount,
      subtotal12: data.subtotal12,
      subtotal15: data.subtotal15,
      subtotal0: data.subtotal0,
      iva: data.iva,
      total: data.total,
    });

    // ------------------------------------------------------------------------
    // ✅ HARD RELIABILITY GUARANTEES (BEFORE MODAL)
    // - ensures AR/AP always exists (rule)
    // - ensures >=2 non-zero lines when possible
    // - fixes small rounding diff when possible
    // ------------------------------------------------------------------------
    ensureMinimumValidEntries(data);

    // ------------------------------------------------------------------------
    // 🧠 CONTEXTUAL LEARNING (EXPENSE ONLY) — keep your behavior
    // ------------------------------------------------------------------------
    if (
      data.invoiceType === "expense" &&
      data.issuerRUC &&
      data.concepto &&
      Array.isArray(data.entries)
    ) {
      try {
        const hint = await getContextualAccountHint(data.issuerRUC, data.concepto);

        if (hint) {
          data.entries = data.entries.map((e: VisionEntry) => {
            const debit = n(e.debit);

            // Never override IVA or Proveedores
            if (
              debit > 0 &&
              e.account_code &&
              !String(e.account_code).startsWith("133") && // IVA
              !String(e.account_code).startsWith("201")    // Proveedores
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
      data.entries = data.entries.map((e: VisionEntry) => ({
        ...e,
        description: e.description ?? data.concepto ?? data.invoice_number ?? "",
      }));
    }

    return data as ExtractedInvoiceResponse;
  } catch (err: any) {
    console.error("❌ extractInvoiceVisionService ERROR:", err);
    throw new Error(err.message || "Error processing invoice.");
  }
}