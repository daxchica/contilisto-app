// ============================================================================
// CONTILISTO — SRI RETENTION CODE RESOLVER
// Resolves SRI retention codes from percentage amounts (legacy path).
// New entries use explicit codes stored in tax.retenciones[].code.
// ============================================================================

import { defaultIRCode, defaultIVACode, SRI_IR_CODES, SRI_IVA_CODES } from "@/constants/sriRetentionCodes";

/** Resolve IR/Renta retention code and label from base + amount */
export function resolveRentaCode(
  base: number,
  amount: number
): { code: string; label: string; percent: number } {
  if (!base || !amount) {
    return { code: "332", label: "Sin retención IR", percent: 0 };
  }

  const percent = +(amount / base * 100).toFixed(2);
  const code = defaultIRCode(percent);
  const entry = SRI_IR_CODES.find((c) => c.code === code);

  return {
    code,
    label: entry?.description ?? entry?.label ?? "Retención IR",
    percent,
  };
}

/** Resolve IVA retention code and label from iva-base + retained amount */
export function resolveIvaCode(
  ivaBase: number,
  amount: number
): { code: string; label: string; percent: number | null } {
  if (!ivaBase || !amount) {
    return { code: "0", label: "Sin retención IVA (0%)", percent: 0 };
  }

  const percent = +(amount / ivaBase * 100).toFixed(2);
  const code = defaultIVACode(percent);
  const entry = SRI_IVA_CODES.find((c) => c.code === code);

  return {
    code,
    label: entry?.description ?? entry?.label ?? "Retención IVA",
    percent,
  };
}
