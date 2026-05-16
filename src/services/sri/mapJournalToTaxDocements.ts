// ============================================================================
// CONTILISTO — TAX DOCUMENT MAPPER
// Groups JournalEntries → TaxDocument (per invoice / transaction)
//
// IVA rate history (Ecuador):
//   pre-April 2024  → 12%   → base12
//   April 2024+     → 15%   → base15
//
// Strategy for bases:
//   1. When the entry carries tax.bases[] (expense line with full SRI metadata),
//      read base and rate directly — most accurate.
//   2. Fallback: detect from account code (purchase/sale lines without metadata).
//
// IVA amount accounts (actual codes used when entries are created):
//   IVA compras  → 1330101   (debit on purchase)
//   IVA ventas   → 201050101 (credit on sale)
//   Ret. IR      → 201020201 (credit, retention paid to SRI)
//   Ret. IVA     → 201020202 (credit, retention paid to SRI)
//   Ret. IVA rec → 1130202xx (debit, retention received from customer)
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";
import type { TaxDocument } from "@/types/TaxDocument";

function getPeriod(date: string): string {
  return date.slice(0, 7);
}

function n2(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
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

    // ── Init document ────────────────────────────────────────────────────────
    if (!map.has(key)) {
      map.set(key, {
        entityId:    e.entityId || "",
        transactionId: key,
        date:        e.date,
        period:      getPeriod(e.date),
        type:        "purchase",

        documentNumber:
          e.invoice_number ||
          (e.comment?.match(/\d{3}-\d{3}-\d{9}/)?.[0]) ||
          "SIN-NUMERO",
        authorizationNumber: e.tax?.document?.authorization,
        documentType: "factura",

        estab:    e.tax?.document?.establishment,
        ptoEmi:   e.tax?.document?.emissionPoint,
        secuencial: e.tax?.document?.sequential,

        counterpartyRUC:  e.tax?.supplier?.ruc || e.issuerRUC || e.supplier_ruc,
        counterpartyName: e.tax?.supplier?.name || e.issuerName || e.supplier_name,

        base12:       0,
        base15:       0,
        base0:        0,
        baseNoObjeto: 0,
        ivaVentas:    0,
        ivaCompras:   0,
        ice:          0,
        ivaRetention:   0,
        rentaRetention: 0,
        total:        0,
        sourceEntries: [],
      });
    }

    const doc = map.get(key)!;
    doc.sourceEntries.push(e);

    const code   = e.account_code || "";
    const debit  = n2(e.debit);
    const credit = n2(e.credit);

    // ── Detect sale vs purchase ───────────────────────────────────────────────
    if (code.startsWith("4")) {
      doc.type = "sale";
    }
    // Also detect from documentNature stored on the entry
    if (e.documentNature === "sale") {
      doc.type = "sale";
    }

    // ── Counterparty — fill from any entry that has it ────────────────────────
    if (!doc.counterpartyRUC) {
      doc.counterpartyRUC =
        e.tax?.supplier?.ruc || e.issuerRUC || e.supplier_ruc ||
        (e as any).customerRUC || (e as any).customer_ruc;
    }
    if (!doc.counterpartyName) {
      doc.counterpartyName =
        e.tax?.supplier?.name || e.issuerName || e.supplier_name ||
        (e as any).customerName || (e as any).customer_name;
    }

    // ── Authorization key ─────────────────────────────────────────────────────
    if (!doc.authorizationNumber && e.tax?.document?.authorization) {
      doc.authorizationNumber = e.tax.document.authorization;
    }

    // ── BASES ─────────────────────────────────────────────────────────────────
    //
    // Priority 1: use tax.bases[] for accurate rate split (set by AI/XML parsers)
    // Priority 2: account code fallback
    //
    const hasTaxBases = Array.isArray(e.tax?.bases) && (e.tax!.bases!.length > 0);

    if (hasTaxBases && (code.startsWith("5") || code.startsWith("4"))) {
      // Read each base/rate pair from the structured metadata
      for (const b of e.tax!.bases!) {
        const base = n2(b.base);
        if (base <= 0) continue;
        if (b.rate === 15) doc.base15 += base;
        else if (b.rate === 12) doc.base12 += base;
        else doc.base0 += base;
      }
    } else {
      // Fallback: infer from account code only
      if (code.startsWith("4") && credit > 0) {
        // Sale revenue — we don't know the rate here, assume based on period
        // (base will be split correctly once IVA amount is known)
        doc.base12 += credit; // will be recalculated below from IVA
      }
      if (code.startsWith("5") && debit > 0) {
        doc.base12 += debit;
      }
    }

    // Base 0% (no IVA) — typically goes to accounts with no linked IVA debit
    // Currently no dedicated account prefix for base 0 — rely on tax.bases

    // ── IVA AMOUNTS ──────────────────────────────────────────────────────────

    // IVA Ventas → account 201050101 (credit when invoice is issued)
    if (code.startsWith("20105") && credit > 0) {
      doc.ivaVentas += credit;
    }

    // IVA Compras → account 1330101 (debit when purchasing)
    if (code.startsWith("133") && debit > 0) {
      doc.ivaCompras += debit;
    }

    // ── RETENTIONS ───────────────────────────────────────────────────────────

    // IVA retention RECEIVED from customers (debited to a receivable account)
    if (code.startsWith("11302") && debit > 0) {
      doc.ivaRetention += debit;
    }

    // Renta retention PAID to SRI as retention agent (credit on liability)
    if (code.startsWith("201020201") && credit > 0) {
      doc.rentaRetention += credit;
    }
  }

  // ── Post-processing: fix base split using IVA amounts when bases came from
  //    account-code fallback (no tax.bases metadata available)
  // ─────────────────────────────────────────────────────────────────────────
  return Array.from(map.values()).map((doc) => {
    // For sale entries where base came from fallback (all in base12) but we have
    // ivaVentas, we can infer the rate and move to base15 if needed.
    // Ecuador changed rate on 2024-04-01.
    if (doc.type === "sale" && doc.base12 > 0 && doc.base15 === 0 && doc.ivaVentas > 0) {
      const impliedRate = n2((doc.ivaVentas / doc.base12) * 100);
      if (impliedRate >= 14 && impliedRate <= 16) {
        // IVA at 15% → reclassify
        doc.base15 = doc.base12;
        doc.base12 = 0;
      }
    }

    const ivaTaxTotal = doc.type === "sale" ? doc.ivaVentas : doc.ivaCompras;
    doc.total = n2(
      doc.base12 + doc.base15 + doc.base0 + doc.baseNoObjeto + ivaTaxTotal + doc.ice
    );

    return doc;
  });
}
