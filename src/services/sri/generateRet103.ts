// ============================================================================
// CONTILISTO — Formulario 103 Generator (RETENCIONES)
// PRODUCTION SAFE VERSION
// ============================================================================

import type { TaxLedgerEntry } from "@/types/TaxLedgerEntry";

export interface Ret103Summary {
  period: string;

  // IVA retentions
  ivaRetenido: number;

  // Income tax retentions
  rentaRetenida: number;

  totalRetenciones: number;
}

/* =============================================================================
   HELPERS
============================================================================= */

function n2(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

/* =============================================================================
   MAIN FUNCTION
============================================================================= */

export function generateRet103Summary(
  ledger: TaxLedgerEntry[],
  entityId: string,
  period: string
): Ret103Summary {

  let ivaRetenido = 0;
  let rentaRetenida = 0;

  for (const e of ledger) {

    if (!e) continue;

    // ✅ entity filter
    if (e.entityId !== entityId) continue;

    // ✅ period filter (FIXED)
    if (!e.date.startsWith(period)) continue;

    // ✅ ONLY include payment / retention transactions
    const isRelevant =
      e.transactionType === "payment" ||
      e.type === "retention";

    if (!isRelevant) continue;

    // ✅ accumulate safely
    ivaRetenido += n2(e.ivaRetentionPaid);
    rentaRetenida += n2(e.rentaRetentionPaid);
  }

  // ✅ final rounding (SRI safe)
  ivaRetenido = n2(ivaRetenido);
  rentaRetenida = n2(rentaRetenida);

  return {
    period,
    ivaRetenido,
    rentaRetenida,
    totalRetenciones: n2(ivaRetenido + rentaRetenida),
  };
}