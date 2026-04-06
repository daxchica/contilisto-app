// ============================================================================
// CONTILISTO — Formulario 103 Generator (RETENCIONES)
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

export function generateRet103Summary(
  ledger: TaxLedgerEntry[],
  entityId: string,
  period: string
): Ret103Summary {

  let ivaRetenido = 0;
  let rentaRetenida = 0;

  for (const e of ledger) {

    if (!e) continue;
    if (e.entityId !== entityId) continue;
    if (e.date.startsWith(period)) continue;

    ivaRetenido += e.ivaRetentionPaid || 0;
    rentaRetenida += e.rentaRetentionPaid || 0;

  }

  return {
    period,
    ivaRetenido,
    rentaRetenida,
    totalRetenciones: ivaRetenido + rentaRetenida,
  };
}