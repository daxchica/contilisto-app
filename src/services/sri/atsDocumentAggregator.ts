// ============================================================================
// src/services/sri/atsDocumentAggregator.ts
// CONTILISTO — ATS from Tax Ledger (FIXED)
// ============================================================================

import type { TaxLedgerEntry } from "@/types/TaxLedgerEntry";
import type { AtsDocument } from "@/types/atsDocument";

export function buildAtsDocuments(
  ledger: TaxLedgerEntry[],
  entityId: string,
  period: string
): AtsDocument[] {

  return ledger
    .filter(e =>
      e &&
      e.entityId === entityId &&
      e.period === period
    )
    .map(e => ({
      id: e.documentNumber || e.date,

      entityId,
      period,

      documentType: e.type === "sale" ? "18" : "01",

      establishment: "001",
      emissionPoint: "001",

      sequential: e.documentNumber || "",

      authorizationNumber: "",

      date: e.date,

      ruc: e.ruc || "",
      razonSocial: e.name || "",

      base12: e.base12 || 0,

      base0: e.base0 || 0,

      iva: e.iva || 0,

      ice: 0,

      retenciones: undefined,

      journalEntryIds: [],
    }));

  }
