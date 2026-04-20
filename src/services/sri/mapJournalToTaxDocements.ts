// ============================================================================
// CONTILISTO — TAX DOCUMENT MAPPER (UPDATED FOR NEW TaxDocument)
// Groups JournalEntries → TaxDocument (per invoice)
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";
import type { TaxDocument } from "@/types/TaxDocument";

function getPeriod(date: string): string {
  return date.slice(0, 7);
}

export function mapJournalToTaxDocuments(
  entries: JournalEntry[]
): TaxDocument[] {
  const map = new Map<string, TaxDocument>();

  for (const e of entries) {
    const key =
      e.transactionId ||
      e.invoice_number ||
      `${e.date}-${Math.random()}`;

    // =========================
    // INIT DOCUMENT
    // =========================
    if (!map.has(key)) {
      map.set(key, {
        entityId: e.entityId || "",
        transactionId: key,
        date: e.date,
        period: getPeriod(e.date),
        type: "purchase",

        documentNumber:
          e.invoice_number ||
          (e.comment?.match(/\d{3}-\d{3}-\d{9}/)?.[0]) ||
          "SIN-NUMERO",
        authorizationNumber: undefined,
        documentType: "factura",

        estab: undefined,
        ptoEmi: undefined,
        secuencial: undefined,

        counterpartyRUC: undefined,
        counterpartyName: undefined,

        base12: 0,
        base0: 0,
        baseNoObjeto: 0,

        ivaVentas: 0,
        ivaCompras: 0,

        ice: 0,

        ivaRetention: 0,
        rentaRetention: 0,

        total: 0,

        sourceEntries: [],
      });
    }

    const doc = map.get(key)!;
    doc.sourceEntries.push(e);

    const code = e.account_code || "";

    // =========================
    // DETECT TYPE (SALE vs PURCHASE)
    // =========================
    if (code.startsWith("4")) {
      doc.type = "sale";
    }

    // =========================
    // BASES
    // =========================

    // SALES BASE (credit revenue)
    if (code.startsWith("4") && e.credit) {
      doc.base12 += e.credit;
    }

    // PURCHASE BASE (expense accounts)
    if ((code.startsWith("5") || code.startsWith("6")) && e.debit) {
      doc.base12 += e.debit;
    }

    // =========================
    // IVA (SEPARATED — CRITICAL)
    // =========================

    // IVA VENTAS
    if (code.startsWith("20102") && e.credit) {
      doc.ivaVentas += e.credit;
    }

    // IVA COMPRAS
    if (code.startsWith("133") && e.debit) {
      doc.ivaCompras += e.debit;
    }

    // =========================
    // RETENTIONS
    // =========================

    // IVA RETENTION
    if (code.startsWith("213") && e.credit) {
      doc.ivaRetention += e.credit;
    }

    // RENTA RETENTION
    if (code.startsWith("303") && e.credit) {
      doc.rentaRetention += e.credit;
    }
  }

  // =========================
  // FINAL CALCULATIONS
  // =========================

  return Array.from(map.values()).map((doc) => {
    const ivaTotal =
      doc.type === "sale" ? doc.ivaVentas : doc.ivaCompras;

    doc.total =
      doc.base12 +
      doc.base0 +
      doc.baseNoObjeto +
      ivaTotal +
      doc.ice;

    return doc;
  });
}