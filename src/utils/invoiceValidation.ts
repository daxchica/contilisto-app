// src/utils/invoiceValidation.ts

import type { OCRInvoiceResult } from "@/services/extractInvoiceOCRService";

type OCRWithTotals = {
  total?: number;
  valor_total?: number;
  totalAmount?: number;

  iva?: number;
  iva_amount?: number;

  subtotal_iva?: number;
  subtotal_15?: number;
  subtotal_12?: number;

  _pagesDetected?: number;
  _totalsPageDetected?: boolean;
};

export function isInvoiceIncomplete(
  ocr: OCRInvoiceResult
): boolean {
  if (!ocr) return true;

  const data = ocr as OCRWithTotals;

  // ------------------------------------------------------------------
  // 1️⃣ Mandatory structural fields
  // ------------------------------------------------------------------
  if (!Array.isArray(ocr.entries) || ocr.entries.length === 0) return true;
  if (!ocr.invoice_number?.trim()) return true;
  if (!ocr.invoiceType) return true;

  // ------------------------------------------------------------------
  // 2️⃣ Totals presence (CRITICAL)
  // ------------------------------------------------------------------
  const total =
    Number(
        data.total ??
        data.valor_total ??
        data.totalAmount ??
        0
    );

  if (total <= 0) return true;

  // ------------------------------------------------------------------
// 3️⃣ IVA consistency (Ecuador SRI logic)
// ------------------------------------------------------------------
const iva = Number(data.iva ?? data.iva_amount ?? 0);

const subtotal12 = Number(data.subtotal_12 ?? 0);
const subtotal15 = Number(data.subtotal_15 ?? 0);
const subtotalIva = Number(data.subtotal_iva ?? 0);

// Determine taxable base & rate
let taxableBaseWithVat = 0;
let taxRate: 12 | 15 | 0 = 0;

if (subtotal15 > 0) {
  taxableBaseWithVat = subtotal15;
  taxRate = 15;
} else if (subtotal12 > 0) {
  taxableBaseWithVat = subtotal12;
  taxRate = 12;
} else if (subtotalIva > 0 && iva > 0) {
    taxableBaseWithVat = subtotalIva;
    taxRate = 
        Math.abs(iva / subtotalIva - 0.15) < 0.02
        ? 15
        : 12;
}


// 🚫 IVA exists but no taxable base
if (iva > 0 && taxableBaseWithVat <= 0) return true;

// 🚫 Taxable base exists but IVA = 0 (invalid in SRI)
if (taxableBaseWithVat > 0 && iva === 0) {
return true;
}

// 🚫 IVA amount inconsistent with base
if (iva > 0 && taxableBaseWithVat > 0 && taxRate > 0) {
  const expectedIva = Number((taxableBaseWithVat * taxRate / 100).toFixed(2));

  if (Math.abs(expectedIva - iva) > 0.02) {
    return true;
  }
}

// ------------------------------------------------------------------
// 4️⃣ Totals reconciliation (accounting invariant)
// ------------------------------------------------------------------
const debitSum = ocr.entries.reduce(
(sum, e) => sum + Number(e.debit || 0), 0);

const creditSum = ocr.entries.reduce(
(sum, e) => sum + Number(e.credit || 0), 0);

if (Math.abs(debitSum - creditSum) > 0.02) {
return true;
}

// ------------------------------------------------------------------
// 5️⃣ Multi-page safety (VERY IMPORTANT)
// If OCR hints multiple pages but totals weren't confidently parsed
// ------------------------------------------------------------------
if (
(ocr as any)._pagesDetected > 1 &&
total <= 0
) {
return true;
}

return false;
}