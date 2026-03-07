// ============================================================================
// src/services/sri/taxLedgerBuilder.ts
// CONTILISTO — Tax Ledger Builder
// Builds normalized tax ledger from Document Registry
// ============================================================================

import type { AccountingDocument } from "@/types/AccountingDocument";
import type { TaxLedgerEntry } from "@/types/TaxLedgerEntry";

export function buildTaxLedger(
  documents: AccountingDocument[],
  entityId?: string,
  period?: string
): TaxLedgerEntry[] {
  return documents
    .filter((doc) => {
      if (!doc) return false;
      if (entityId && doc.entityId !== entityId) return false;
      if (period && doc.period !== period) return false;
      if (doc.status === "cancelled") return false;
      return true;
    })
    .flatMap((doc): TaxLedgerEntry[] => {
      if (doc.type === "sales_invoice") {
        return [
          {
            entityId: doc.entityId,
            documentId: doc.id,
            documentNumber: doc.documentNumber,
            date: doc.issueDate,
            period: doc.period,
            type: "sale",
            ruc: doc.counterpartyRUC,
            name: doc.counterpartyName,
            base12: Number(doc.subtotal12 ?? 0),
            base0: Number(doc.subtotal0 ?? 0),
            iva: Number(doc.iva ?? 0),
            retentionIva: 0,
            retentionRenta: 0,
            authorizationNumber: doc.authorizationNumber,
            paymentMethod: doc.paymentMethod,
          },
        ];
      }

      if (doc.type === "purchase_invoice") {
        return [
          {
            entityId: doc.entityId,
            documentId: doc.id,
            documentNumber: doc.documentNumber,
            date: doc.issueDate,
            period: doc.period,
            type: "purchase",
            ruc: doc.counterpartyRUC,
            name: doc.counterpartyName,
            base12: Number(doc.subtotal12 ?? 0),
            base0: Number(doc.subtotal0 ?? 0),
            iva: Number(doc.iva ?? 0),
            retentionIva: 0,
            retentionRenta: 0,
            authorizationNumber: doc.authorizationNumber,
            paymentMethod: doc.paymentMethod,
          },
        ];
      }

      if (doc.type === "retention") {
        const totalRetentionIva = (doc.retenciones ?? [])
          .filter((r) => r.taxType === "IVA")
          .reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

        const totalRetentionRenta = (doc.retenciones ?? [])
          .filter((r) => r.taxType === "RENTA")
          .reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

        return [
          {
            entityId: doc.entityId,
            documentId: doc.id,
            documentNumber: doc.documentNumber,
            date: doc.issueDate,
            period: doc.period,
            type: "retention",
            ruc: doc.counterpartyRUC,
            name: doc.counterpartyName,
            base12: Number(doc.subtotal12 ?? 0),
            base0: Number(doc.subtotal0 ?? 0),
            iva: Number(doc.iva ?? 0),
            retentionIva: totalRetentionIva,
            retentionRenta: totalRetentionRenta,
            authorizationNumber: doc.authorizationNumber,
            paymentMethod: doc.paymentMethod,
          },
        ];
      }

      return [];
    });
}