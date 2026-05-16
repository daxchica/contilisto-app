// ============================================================================
// src/services/sri/atsDocumentAggregator.ts
// CONTILISTO — ATS Aggregator (UPDATED FOR NEW AtsDocument TYPE)
// ============================================================================

import type { TaxLedgerEntry } from "@/types/TaxLedgerEntry";
import type { AtsDocument, AtsRetention } from "@/types/atsDocument";

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
  if (entry.documentType) return String(entry.documentType).trim();

  if (entry.type === "retention") return "07";
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

    if (ivaRet > 0) {
      doc.ivaRetention = n2(doc.ivaRetention + ivaRet);

      const ivaPercent = baseForRetention > 0
        ? n2((ivaRet / baseForRetention) * 100)
        : 0;
      // Resolve IVA retention code from percentage (SRI catalogue)
      const ivaCode =
        ivaPercent === 10  ? "440"  :
        ivaPercent === 20  ? "440b" :
        ivaPercent === 30  ? "441"  :
        ivaPercent === 50  ? "441b" :
        ivaPercent === 70  ? "442"  :
        ivaPercent === 100 ? "443"  : "441";

      pushOrMergeRetention(doc.retenciones, {
        taxType: "IVA",
        code: ivaCode,
        percentage: ivaPercent,
        base: baseForRetention,
        amount: ivaRet,
      });
    }

    if (rentaRet > 0) {
      doc.rentaRetention = n2(doc.rentaRetention + rentaRet);

      const rentaPercent = baseForRetention > 0
        ? n2((rentaRet / baseForRetention) * 100)
        : 0;
      // Resolve Renta retention code from percentage (SRI catalogue)
      const rentaCode =
        rentaPercent === 1    ? "332"  :
        rentaPercent === 1.75 ? "333"  :
        rentaPercent === 2    ? "334"  :
        rentaPercent === 2.75 ? "3440" :
        rentaPercent === 8    ? "344"  :
        rentaPercent === 10   ? "303"  : "332";

      pushOrMergeRetention(doc.retenciones, {
        taxType: "RENTA",
        code: rentaCode,
        percentage: rentaPercent,
        base: baseForRetention,
        amount: rentaRet,
      });
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