// ============================================================================
// CONTILISTO — Formulario 103 Generator (RETENCIONES)
// IMPROVED / PRODUCTION-SAFE / DETAIL-READY
// ============================================================================

import type { TaxLedgerEntry } from "@/types/TaxLedgerEntry";

export interface Ret103Line {
  code: string;
  label: string;
  base: number;
  amount: number;
  percent?: number | null;
}

export interface Ret103DocumentDetail {
  transactionId: string;
  documentNumber?: string;
  date: string;
  base: number;
  ivaRetention: number;
  rentaRetention: number;
}

/** Row for the Reporte 103 detail table (renta retentions) */
export interface Ret103LineDetail {
  no: string;
  date: string;
  invoiceNumber: string;
  supplierName: string;
  supplierRUC: string;
  base: number;
  iva: number;
  total: number;
  retentionPercent: number;
  retentionAmount: number;
  retentionCertNumber: string;
  retentionCode: string;
  retentionLabel: string;
}

/** Row for the Reporte 104 IVA detail table */
export interface Ret104LineDetail {
  no: string;
  date: string;
  invoiceNumber: string;
  supplierName: string;
  supplierRUC: string;
  base: number;
  iva: number;
  total: number;
  retentionPercent: number;
  retentionAmount: number;
  retentionCertNumber: string;
  retentionCode: string;
  retentionLabel: string;
}

export interface Ret103Summary {
  period: string;

  // legacy totals (keep for compatibility)
  ivaRetenido: number;
  rentaRetenida: number;
  totalRetenciones: number;

  // grouped lines
  ivaLines: Ret103Line[];
  rentaLines: Ret103Line[];

  // detail for modal / audit traceability
  documents: Ret103DocumentDetail[];

  // per-transaction detail lines for Reporte 103 PDF
  detailLines: Ret103LineDetail[];

  // per-transaction detail lines for Reporte 104 IVA PDF
  ivaDetailLines: Ret104LineDetail[];
}

/* =============================================================================
   HELPERS
============================================================================= */

function n2(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function getPeriod(date?: string): string {
  if (!date) return "";
  return String(date).slice(0, 7);
}

function resolveRentaCode(
  base: number,
  amount: number
): {
  code: string;
  label: string;
  percent: number | null;
} {
  if (base <= 0 || amount <= 0) {
    return {
      code: "332",
      label: "Otras compras de bienes y servicios no sujetas a retención",
      percent: 0,
    };
  }

  const percent = n2((amount / base) * 100);

  if (percent === 1) {
    return { code: "332", label: "Otras compras y servicios 1%", percent };
  }
  if (percent === 1.75) {
    return { code: "333", label: "Retención renta 1.75%", percent };
  }
  if (percent === 2) {
    return { code: "334", label: "Retención renta 2%", percent };
  }
  if (percent === 2.75) {
    return {
      code: "3440",
      label: "Otras retenciones aplicables el 2.75%",
      percent,
    };
  }
  if (percent === 8) {
    return { code: "344", label: "Retención renta 8%", percent };
  }
  if (percent === 10) {
    return {
      code: "303",
      label: "Honorarios profesionales y demás pagos por servicios relacionados con el título",
      percent,
    };
  }

  return {
    code: "999",
    label: "Retención renta no clasificada",
    percent,
  };
}

function resolveIvaCode(
  base: number,
  amount: number
): {
  code: string;
  label: string;
  percent: number | null;
} {
  if (base <= 0 || amount <= 0) {
    return {
      code: "0",
      label: "Sin retención IVA (0%)",
      percent: 0,
    };
  }

  const percent = n2((amount / base) * 100);

  if (percent === 10) {
    return { code: "440", label: "Retención IVA 10%", percent };
  }
  if (percent === 20) {
    return { code: "440b", label: "Retención IVA 20%", percent };
  }
  if (percent === 30) {
    return { code: "441", label: "Retención IVA 30%", percent };
  }
  if (percent === 50) {
    return { code: "441b", label: "Retención IVA 50%", percent };
  }
  if (percent === 70) {
    return { code: "442", label: "Retención IVA 70%", percent };
  }
  if (percent === 100) {
    return { code: "443", label: "Retención IVA 100%", percent };
  }

  return {
    code: "499",
    label: "Retención IVA no clasificada",
    percent,
  };
}

function getDocumentNumber(entry: TaxLedgerEntry): string | undefined {
  return (
    entry.documentNumber ||
    entry.sourceEntries?.[0]?.invoice_number ||
    entry.sourceEntries?.[0]?.comment ||
    entry.sourceEntries?.[0]?.description ||
    undefined
  );
}

function getBaseForRetention(entry: TaxLedgerEntry): number {
  const candidates = [
    entry.base12,
    entry.base0,
    entry.purchaseBase12,
    entry.purchaseBase0,
    entry.salesBase12,
    entry.salesBase0,
  ];

  for (const value of candidates) {
    const normalized = n2(value);
    if (normalized > 0) return normalized;
  }

  return 0;
}

function getIvaForEntry(entry: TaxLedgerEntry): number {
  const candidates = [
    entry.iva,
    entry.purchaseIva,
    entry.salesIva,
  ];
  for (const value of candidates) {
    const normalized = n2(value);
    if (normalized > 0) return normalized;
  }
  return 0;
}

/* =============================================================================
   MAIN FUNCTION
============================================================================= */

export function generateRet103Summary(
  ledger: TaxLedgerEntry[],
  entityId: string,
  period: string
): Ret103Summary {
  const ivaMap = new Map<string, Ret103Line>();
  const rentaMap = new Map<string, Ret103Line>();
  const documentsMap = new Map<string, Ret103DocumentDetail>();

  let ivaRetenido = 0;
  let rentaRetenida = 0;

  const detailLines: Ret103LineDetail[] = [];
  const ivaDetailLines: Ret104LineDetail[] = [];

  let counter103 = 1;
  let counter104 = 1;

  for (const e of ledger) {
    if (!e) continue;
    if (e.entityId !== entityId) continue;
    if (getPeriod(e.date) !== period) continue;

    const ivaAmount = n2(
      e.ivaRetentionPaid ??
        e.ivaRetentionReceived ??
        e.retentionIva ??
        0
    );

    const rentaAmount = n2(
      e.rentaRetentionPaid ??
        e.rentaRetentionReceived ??
        e.retentionRenta ??
        0
    );

    // Only include purchases (we are the retention agent)
    const isPurchase =
      e.documentNature === "purchase" ||
      e.type === "purchase" ||
      ivaAmount > 0 ||
      rentaAmount > 0;

    if (!isPurchase) continue;

    const base = getBaseForRetention(e);
    const iva = getIvaForEntry(e);
    const total = n2(base + iva);

    const docKey =
      e.transactionId ||
      getDocumentNumber(e) ||
      `${e.date}-${e.entityId}`;

    const existingDoc = documentsMap.get(docKey);

    if (!existingDoc) {
      documentsMap.set(docKey, {
        transactionId: e.transactionId || docKey,
        documentNumber: getDocumentNumber(e),
        date: e.date,
        base,
        ivaRetention: ivaAmount,
        rentaRetention: rentaAmount,
      });
    } else {
      existingDoc.base = n2(existingDoc.base + base);
      existingDoc.ivaRetention = n2(existingDoc.ivaRetention + ivaAmount);
      existingDoc.rentaRetention = n2(existingDoc.rentaRetention + rentaAmount);
      documentsMap.set(docKey, existingDoc);
    }

    // ── Renta detail line (include all purchases, even 0% retention) ──
    {
      const rentaResolved =
        rentaAmount > 0
          ? resolveRentaCode(base, rentaAmount)
          : {
              code: "332",
              label: "Otras compras de bienes y servicios no sujetas a retención",
              percent: 0,
            };

      detailLines.push({
        no: String(counter103++),
        date: e.date,
        invoiceNumber: getDocumentNumber(e) ?? "-",
        supplierName: e.counterpartyName ?? e.name ?? "-",
        supplierRUC: e.counterpartyRUC ?? e.ruc ?? "-",
        base,
        iva,
        total,
        retentionPercent: rentaResolved.percent ?? 0,
        retentionAmount: rentaAmount,
        retentionCertNumber: e.authorizationNumber ?? "-",
        retentionCode: rentaResolved.code,
        retentionLabel: rentaResolved.label,
      });
    }

    // ── IVA detail line (include all purchases, even 0% IVA retention) ──
    {
      const ivaResolved =
        ivaAmount > 0
          ? resolveIvaCode(iva > 0 ? iva : base, ivaAmount)
          : {
              code: "0",
              label: "Sin retención IVA (0%)",
              percent: 0,
            };

      ivaDetailLines.push({
        no: String(counter104++),
        date: e.date,
        invoiceNumber: getDocumentNumber(e) ?? "-",
        supplierName: e.counterpartyName ?? e.name ?? "-",
        supplierRUC: e.counterpartyRUC ?? e.ruc ?? "-",
        base,
        iva,
        total,
        retentionPercent: ivaResolved.percent ?? 0,
        retentionAmount: ivaAmount,
        retentionCertNumber: e.authorizationNumber ?? "-",
        retentionCode: ivaResolved.code,
        retentionLabel: ivaResolved.label,
      });
    }

    if (ivaAmount > 0) {
      const ivaBase = iva > 0 ? iva : base;
      const resolved = resolveIvaCode(ivaBase, ivaAmount);

      const current = ivaMap.get(resolved.code) ?? {
        code: resolved.code,
        label: resolved.label,
        base: 0,
        amount: 0,
        percent: resolved.percent,
      };

      current.base = n2(current.base + ivaBase);
      current.amount = n2(current.amount + ivaAmount);

      ivaMap.set(resolved.code, current);

      ivaRetenido = n2(ivaRetenido + ivaAmount);
    }

    if (rentaAmount > 0) {
      const resolved = resolveRentaCode(base, rentaAmount);

      const current = rentaMap.get(resolved.code) ?? {
        code: resolved.code,
        label: resolved.label,
        base: 0,
        amount: 0,
        percent: resolved.percent,
      };

      current.base = n2(current.base + base);
      current.amount = n2(current.amount + rentaAmount);

      rentaMap.set(resolved.code, current);

      rentaRetenida = n2(rentaRetenida + rentaAmount);
    }
  }

  const ivaLines = Array.from(ivaMap.values()).sort((a, b) =>
    a.code.localeCompare(b.code)
  );

  const rentaLines = Array.from(rentaMap.values()).sort((a, b) =>
    a.code.localeCompare(b.code)
  );

  const documents = Array.from(documentsMap.values()).sort((a, b) => {
    if (a.date === b.date) {
      return (a.documentNumber || "").localeCompare(b.documentNumber || "");
    }
    return a.date.localeCompare(b.date);
  });

  return {
    period,
    ivaRetenido: n2(ivaRetenido),
    rentaRetenida: n2(rentaRetenida),
    totalRetenciones: n2(ivaRetenido + rentaRetenida),
    ivaLines,
    rentaLines,
    documents,
    detailLines,
    ivaDetailLines,
  };
}
