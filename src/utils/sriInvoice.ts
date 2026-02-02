// src/utils/sriInvoice.ts

/**
 * Ecuador SRI access key is ALWAYS 49 digits
 */
export function extractAccessKey(text: string): string | null {
  const match = String(text || "").match(/\b\d{49}\b/);
  return match?.[0] ?? "";
}

/**
 * From SRI access key → invoice number
 * Segment: positions 24–38 (15 digits)
 * Format: ESTAB-PTOEMI-SECUENCIAL
 */
export function invoiceNumberFromAccessKey(accessKey: string): string {
  const k= String(accessKey || "").replace(/\D/g, "");
    if (k.length !== 49) return "";

  const estab = k.slice(24, 27);
  const ptoEmi = k.slice(27, 30);
  const secuencial = k.slice(30, 39);

  if (
    estab.length !==3 || 
    ptoEmi.length !==3 || 
    secuencial.length !==9
    ) {
    return "";
    }
  return `${estab}-${ptoEmi}-${secuencial}`;
}
