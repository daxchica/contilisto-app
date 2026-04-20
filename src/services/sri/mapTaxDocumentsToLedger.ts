// ============================================================================
// CONTILISTO — COMPATIBILITY LAYER (DO NOT REMOVE OLD SYSTEM)
// Converts TaxDocument → TaxLedgerEntry
// ============================================================================

import type { TaxDocument } from "@/types/TaxDocument";
import type { TaxLedgerEntry } from "@/types/TaxLedgerEntry";

export function mapTaxDocumentsToLedger(
  docs: TaxDocument[]
): TaxLedgerEntry[] {
  return docs.map((doc) => ({
    entityId: doc.entityId,
    transactionId: doc.transactionId,

    date: doc.date,
    period: doc.period,

    type: doc.type,
    transactionType: "invoice",

    base12: doc.base12,
    base0: doc.base0,
    iva: doc.type === "sale" ? doc.ivaVentas : doc.ivaCompras,

    salesBase12: doc.type === "sale" ? doc.base12 : 0,
    salesBase0: doc.type === "sale" ? doc.base0 : 0,
    salesIva: doc.type === "sale" ? doc.ivaVentas : 0,

    purchaseBase12: doc.type === "purchase" ? doc.base12 : 0,
    purchaseBase0: doc.type === "purchase" ? doc.base0 : 0,    
    purchaseIva: doc.type === "purchase" ? doc.ivaCompras : 0,

    ivaRetentionReceived: doc.ivaRetention,
    rentaRetentionReceived: doc.rentaRetention,

    ivaRetentionPaid: 0,
    rentaRetentionPaid: 0,

    sourceEntries: doc.sourceEntries,
  }));
}