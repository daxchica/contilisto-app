// ============================================================================
// src/services/sri/atsDocumentAggregator.ts
// CONTILISTO — ATS Aggregator (UPDATED FOR NEW AtsDocument TYPE)
// ============================================================================

import type { TaxLedgerEntry } from "@/types/TaxLedgerEntry";
import type { AtsDocument, AtsRetention } from "@/types/atsDocument";
import { defaultIRCode, defaultIVACode } from "@/constants/sriRetentionCodes";

function n2(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function resolveRUC(entry: TaxLedgerEntry): string {
  if (entry.counterpartyRUC) return entry.counterpartyRUC;
  if (entry.ruc) return entry.ruc;

  if (Array.isArray(entry.sourceEntries)) {
    for (const line of entry.sourceEntries) {
      const candidate =
        (line as any)?.ruc ||
        (line as any)?.supplier_ruc ||
        (line as any)?.customer_ruc ||
        "";

      if (candidate) return String(candidate).trim();
    }
  }

  return "9999999999999";
}

function resolveName(entry: TaxLedgerEntry): string {
  if (entry.counterpartyName) return entry.counterpartyName;
  if (entry.name) return entry.name;

  if (Array.isArray(entry.sourceEntries)) {
    for (const line of entry.sourceEntries) {
      const candidate =
        (line as any)?.name ||
        (line as any)?.supplier_name ||
        (line as any)?.customer_name ||
        (line as any)?.description ||
        "";

      if (candidate) return String(candidate).trim();
    }
  }

  return "CONSUMIDOR FINAL";
}

function getDocumentNumber(entry: TaxLedgerEntry): string {
  const raw =
    entry.documentNumber ||
    entry.sourceEntries?.[0]?.invoice_number ||
    "";

  return raw
    .replace(/\s+/g, "")
    .replace(/--+/g, "-")
    .trim();
}

function getDocumentType(entry: TaxLedgerEntry): string {
  const stored = String(entry.documentType ?? "").trim();

  // "07" means a standalone retention certificate document.
  // Payment+retention journal entries (type === "retention") represent the
  // underlying PURCHASE INVOICE, so they must appear in ATS Compras as "01".
  // Their retention detail is already captured in retenciones[].
  if (stored && stored !== "07") return stored;

  if (entry.documentNature === "sale") return "18";
  return "01";
}

function getEstablishment(entry: TaxLedgerEntry): string {
  return String((entry as any).establishment || "001").trim();
}

function getEmissionPoint(entry: TaxLedgerEntry): string {
  return String((entry as any).emissionPoint || "001").trim();
}

function getSequential(entry: TaxLedgerEntry): string {
  return String((entry as any).sequential || entry.documentNumber || "").trim();
}

function pushOrMergeRetention(
  retenciones: AtsRetention[],
  next: AtsRetention
): void {
  const existing = retenciones.find(
    (r) =>
      r.taxType === next.taxType &&
      r.code === next.code &&
      n2(r.percentage) === n2(next.percentage)
  );

  if (existing) {
    existing.base = n2(existing.base + next.base);
    existing.amount = n2(existing.amount + next.amount);
    return;
  }

  retenciones.push({
    taxType: next.taxType,
    code: next.code,
    percentage: n2(next.percentage),
    base: n2(next.base),
    amount: n2(next.amount),
  });
}

export function buildAtsDocuments(
  ledger: TaxLedgerEntry[],
  entityId: string,
  period: string
): AtsDocument[] {
  const map = new Map<string, AtsDocument>();

  for (const entry of Array.isArray(ledger) ? ledger : []) {
    if (!entry) continue;
    if (entry.entityId !== entityId) continue;
    if (entry.period !== period) continue;
    if (entry.transactionType === "transfer") continue;

    const isRelevant =
      entry.type === "sale" ||
      entry.type === "purchase" ||
      entry.type === "retention" ||
      n2(entry.ivaRetentionPaid) > 0 ||
      n2(entry.ivaRetentionReceived) > 0 ||
      n2(entry.rentaRetentionPaid) > 0 ||
      n2(entry.rentaRetentionReceived) > 0;

    if (!isRelevant) continue;

    const key =
      entry.transactionId ||
      getDocumentNumber(entry) ||
      `${entry.date}-${entry.entityId}`;

    if (!map.has(key)) {
      map.set(key, {
        id: key,
        transactionId: key,
        entityId,
        period,

        documentType: getDocumentType(entry),
        documentNumber: getDocumentNumber(entry),

        establishment: getEstablishment(entry),
        emissionPoint: getEmissionPoint(entry),
        sequential: getSequential(entry),

        authorizationNumber: String(entry.authorizationNumber || "").trim(),
        date: entry.date,

        counterpartyRUC: resolveRUC(entry),
        counterpartyName: resolveName(entry),

        type: entry.type === "sale" ? "sale" : "purchase",

        base12: 0,
        base0: 0,
        baseNoObjeto: 0,

        iva: 0,
        ice: 0,

        ivaRetention: 0,
        rentaRetention: 0,

        retenciones: [],

        total: 0,

        journalEntryIds: [],
      });
    }

    const doc = map.get(key)!;

    if (entry.type === "sale") {
      doc.type = "sale";
    }

    if (!doc.counterpartyRUC) doc.counterpartyRUC = resolveRUC(entry);
    if (!doc.counterpartyName) doc.counterpartyName = resolveName(entry);
    if (!doc.documentNumber) doc.documentNumber = getDocumentNumber(entry);
    if (!doc.authorizationNumber) {
      doc.authorizationNumber = String(entry.authorizationNumber || "").trim();
    }

    doc.base12 = n2(doc.base12 + (entry.base12 ?? 0));
    doc.base0 = n2(doc.base0 + (entry.base0 ?? 0));
    doc.iva = n2(doc.iva + (entry.iva ?? 0));
    doc.ice = n2(doc.ice + 0);

    const baseForRetention = n2(
      entry.base12 ??
        entry.purchaseBase12 ??
        entry.salesBase12 ??
        0
    );

    const ivaRet = n2(entry.ivaRetentionPaid ?? entry.ivaRetentionReceived ?? 0);
    const rentaRet = n2(
      entry.rentaRetentionPaid ?? entry.rentaRetentionReceived ?? 0
    );

    // Prefer stored retenciones[] (set when user selected concept in payment
    // modal, or when a retention XML was uploaded) — they carry the exact SRI
    // code.  Fall back to percentage-based derivation for legacy entries.
    const storedRetenciones = Array.isArray(entry.retenciones)
      ? entry.retenciones
      : [];

    const storedIVA   = storedRetenciones.filter((r) => r.taxType === "IVA");
    const storedRENTA = storedRetenciones.filter((r) => r.taxType === "RENTA");

    if (ivaRet > 0) {
      doc.ivaRetention = n2(doc.ivaRetention + ivaRet);

      if (storedIVA.length > 0) {
        // Use stored retention lines directly
        for (const r of storedIVA) {
          pushOrMergeRetention(doc.retenciones, {
            taxType: "IVA",
            code: r.code,
            percentage: n2(r.percentage),
            base: n2(r.base),
            amount: n2(r.amount),
          });
        }
      } else {
        // Legacy: derive code from percentage
        const ivaPercent = baseForRetention > 0
          ? n2((ivaRet / baseForRetention) * 100)
          : 0;
        pushOrMergeRetention(doc.retenciones, {
          taxType: "IVA",
          code: defaultIVACode(ivaPercent),
          percentage: ivaPercent,
          base: baseForRetention,
          amount: ivaRet,
        });
      }
    }

    if (rentaRet > 0) {
      doc.rentaRetention = n2(doc.rentaRetention + rentaRet);

      if (storedRENTA.length > 0) {
        // Use stored retention lines directly
        for (const r of storedRENTA) {
          pushOrMergeRetention(doc.retenciones, {
            taxType: "RENTA",
            code: r.code,
            percentage: n2(r.percentage),
            base: n2(r.base),
            amount: n2(r.amount),
          });
        }
      } else {
        // Legacy: derive code from percentage
        const rentaPercent = baseForRetention > 0
          ? n2((rentaRet / baseForRetention) * 100)
          : 0;
        pushOrMergeRetention(doc.retenciones, {
          taxType: "RENTA",
          code: defaultIRCode(rentaPercent),
          percentage: rentaPercent,
          base: baseForRetention,
          amount: rentaRet,
        });
      }
    }

    if (Array.isArray(entry.sourceEntries)) {
      for (const line of entry.sourceEntries) {
        if (line?.id && !doc.journalEntryIds.includes(line.id)) {
          doc.journalEntryIds.push(line.id);
        }
      }
    }
  }

  for (const doc of map.values()) {
    doc.total = n2(
      doc.base12 +
        doc.base0 +
        doc.baseNoObjeto +
        doc.iva +
        doc.ice
    );
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.date === b.date) {
      return a.documentNumber.localeCompare(b.documentNumber);
    }
    return a.date.localeCompare(b.date);
  });
}