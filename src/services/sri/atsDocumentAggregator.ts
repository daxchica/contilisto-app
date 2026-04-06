// ============================================================================
// src/services/sri/atsDocumentAggregator.ts
// CONTILISTO — ATS from Tax Ledger (PRODUCTION SAFE)
// ============================================================================

import type { TaxLedgerEntry } from "@/types/TaxLedgerEntry";
import type { AtsDocument } from "@/types/atsDocument";

function n2(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

export function buildAtsDocuments(
  ledger: TaxLedgerEntry[],
  entityId: string,
  period: string
): AtsDocument[] {
  return (Array.isArray(ledger) ? ledger : [])
    .filter((entry) => {
      if (!entry) return false;
      if (entry.entityId !== entityId) return false;
      if (entry.period !== period) return false;
      if (entry.transactionType === "transfer") return false;

      // ATS should mainly represent invoice support documents and retention docs
      return (
        entry.type === "sale" ||
        entry.type === "purchase" ||
        entry.type === "retention"
      );
    })
    .map((entry) => {
      const retenciones =
        entry.type === "retention" ||
        n2(entry.ivaRetentionPaid) > 0 ||
        n2(entry.rentaRetentionPaid) > 0
          ? [
              ...(n2(entry.rentaRetentionPaid) > 0
                ? [
                    {
                      taxType: "RENTA" as const,
                      code: "001",
                      percentage: 0,
                      base: 0,
                      amount: n2(entry.rentaRetentionPaid),
                    },
                  ]
                : []),
              ...(n2(entry.ivaRetentionPaid) > 0
                ? [
                    {
                      taxType: "IVA" as const,
                      code: "001",
                      percentage: 0,
                      base: 0,
                      amount: n2(entry.ivaRetentionPaid),
                    },
                  ]
                : []),
            ]
          : undefined;

      return {
        id: entry.transactionId,

        entityId,
        period,

        documentType:
          entry.documentType ||
          (entry.type === "retention"
            ? "07"
            : entry.documentNature === "sale"
            ? "18"
            : "01"),

        establishment: "001",
        emissionPoint: "001",
        sequential: entry.documentNumber || "",
        authorizationNumber: entry.authorizationNumber || "",

        date: entry.date,

        ruc: entry.ruc || entry.counterpartyRUC || "",
        razonSocial: entry.name || entry.counterpartyName || "",

        base12: n2(entry.base12),
        base0: n2(entry.base0),
        iva: n2(entry.iva),
        ice: 0,

        retenciones,
        journalEntryIds: entry.sourceEntries
          .map((line) => line.id)
          .filter((id): id is string => Boolean(id)),
      };
    });
}