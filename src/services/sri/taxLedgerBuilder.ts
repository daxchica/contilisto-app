// ============================================================================
// src/services/sri/taxLedgerBuilder.ts
// CONTILISTO — Tax Ledger Builder (PRODUCTION SAFE)
// Builds normalized tax ledger from Document Registry
// ============================================================================

import type { AccountingDocument } from "@/types/AccountingDocument";
import type { TaxLedgerEntry } from "@/types/TaxLedgerEntry";

/* =============================================================================
   HELPERS
============================================================================= */

function n2(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

/* =============================================================================
   BUILDER
============================================================================= */

export function buildTaxLedger(
  documents: AccountingDocument[],
  entityId?: string,
  period?: string
): TaxLedgerEntry[] {
  return (documents ?? [])
    .filter((doc) => {
      if (!doc) return false;
      if (entityId && doc.entityId !== entityId) return false;
      if (period && doc.period !== period) return false;
      if (doc.status === "cancelled") return false;
      return true;
    })
    .flatMap((doc): TaxLedgerEntry[] => {
      
      // =========================
      // SALES INVOICE
      // =========================
      if (doc.type === "sales_invoice") {
        return [
          {
            entityId: doc.entityId,
            transactionId: doc.transactionId ?? doc.id, // 🔥 required field

            documentId: doc.id, // ✅ NOW VALID (after type fix)
            documentNumber: doc.documentNumber,

            date: doc.issueDate,
            period: doc.period,

            type: "sale",
            transactionType: "invoice",
            documentNature: "sale",

            ruc: doc.counterpartyRUC,
            name: doc.counterpartyName,

            base12: n2(doc.subtotal12),
            base0: n2(doc.subtotal0),
            iva: n2(doc.iva),

            salesBase12: n2(doc.subtotal12),
            salesBase0: n2(doc.subtotal0),
            salesIva: n2(doc.iva),

            purchaseBase12: 0,
            purchaseBase0: 0,
            purchaseIva: 0,

            ivaRetentionReceived: 0,
            rentaRetentionReceived: 0,

            ivaRetentionPaid: 0,
            rentaRetentionPaid: 0,

            retentionIva: 0,
            retentionRenta: 0,

            authorizationNumber: doc.authorizationNumber,
            paymentMethod: doc.paymentMethod,

            counterpartyRUC: doc.counterpartyRUC,
            counterpartyName: doc.counterpartyName,

            sourceEntries: [], // 🔥 no journal yet (document-based)
          },
        ];
      }

      // =========================
      // PURCHASE INVOICE
      // =========================
      if (doc.type === "purchase_invoice") {
        return [
          {
            entityId: doc.entityId,
            transactionId: doc.transactionId ?? doc.id,

            documentId: doc.id,
            documentNumber: doc.documentNumber,

            date: doc.issueDate,
            period: doc.period,

            type: "purchase",
            transactionType: "invoice",
            documentNature: "purchase",

            ruc: doc.counterpartyRUC,
            name: doc.counterpartyName,

            base12: n2(doc.subtotal12),
            base0: n2(doc.subtotal0),
            iva: n2(doc.iva),

            salesBase12: 0,
            salesBase0: 0,
            salesIva: 0,

            purchaseBase12: n2(doc.subtotal12),
            purchaseBase0: n2(doc.subtotal0),
            purchaseIva: n2(doc.iva),

            ivaRetentionReceived: 0,
            rentaRetentionReceived: 0,

            ivaRetentionPaid: 0,
            rentaRetentionPaid: 0,

            retentionIva: 0,
            retentionRenta: 0,

            authorizationNumber: doc.authorizationNumber,
            paymentMethod: doc.paymentMethod,

            counterpartyRUC: doc.counterpartyRUC,
            counterpartyName: doc.counterpartyName,

            sourceEntries: [],
          },
        ];
      }

      // =========================
      // RETENTION
      // =========================
      if (doc.type === "retention") {
        const totalRetentionIva = (doc.retenciones ?? [])
          .filter((r) => r.taxType === "IVA")
          .reduce((sum, r) => sum + n2(r.amount), 0);

        const totalRetentionRenta = (doc.retenciones ?? [])
          .filter((r) => r.taxType === "RENTA")
          .reduce((sum, r) => sum + n2(r.amount), 0);

        return [
          {
            entityId: doc.entityId,
            transactionId: doc.transactionId ?? doc.id,

            documentId: doc.id,
            documentNumber: doc.documentNumber,

            date: doc.issueDate,
            period: doc.period,

            type: "retention",
            transactionType: "invoice",
            documentNature: "purchase",

            ruc: doc.counterpartyRUC,
            name: doc.counterpartyName,

            base12: n2(doc.subtotal12),
            base0: n2(doc.subtotal0),
            iva: n2(doc.iva),

            salesBase12: 0,
            salesBase0: 0,
            salesIva: 0,

            purchaseBase12: n2(doc.subtotal12),
            purchaseBase0: n2(doc.subtotal0),
            purchaseIva: n2(doc.iva),

            ivaRetentionReceived: 0,
            rentaRetentionReceived: 0,

            ivaRetentionPaid: totalRetentionIva,
            rentaRetentionPaid: totalRetentionRenta,

            retentionIva: totalRetentionIva,
            retentionRenta: totalRetentionRenta,

            authorizationNumber: doc.authorizationNumber,
            paymentMethod: doc.paymentMethod,

            counterpartyRUC: doc.counterpartyRUC,
            counterpartyName: doc.counterpartyName,

            sourceEntries: [],
          },
        ];
      }

      return [];
    });
}