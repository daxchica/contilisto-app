// ============================================================================
// src/services/sri/atsDocumentAggregator.ts
// CONTILISTO — ATS Document Aggregator
// Converts Journal Entries → ATS Documents
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";
import type { AtsDocument } from "@/types/atsDocument";

/* =============================================================================
   ACCOUNT DETECTORS
============================================================================= */

function isSalesAccount(code?: string) {
  return String(code ?? "").startsWith("4");
}

function isPurchaseAccount(code?: string) {
  const c = String(code ?? "");
  return c.startsWith("5") || c.startsWith("6");
}

function isReceivableAccount(code?: string) {
  const c = String(code ?? "");
  return c.startsWith("10103") || c.startsWith("1101");
}

function isIvaSalesAccount(code?: string) {
  return String(code ?? "").startsWith("201020101");
}

function isIvaPurchaseAccount(code?: string) {
  return String(code ?? "").startsWith("13301");
}

/* =============================================================================
   DOCUMENT TYPE INFERENCE
============================================================================= */

function inferDocumentType(lines: JournalEntry[]): "18" | "01" | "07" {

  const hasRetention = lines.some(
    (e) => Array.isArray(e.tax?.retenciones) && e.tax!.retenciones.length > 0
  );

  if (hasRetention) return "07";

  const hasSales =
    lines.some((e) => isSalesAccount(e.account_code)) ||
    lines.some((e) => isReceivableAccount(e.account_code)) ||
    lines.some((e) => isIvaSalesAccount(e.account_code));

  if (hasSales) return "18";

  return "01";
}

/* =============================================================================
   BASE + IVA CALCULATORS
============================================================================= */

function sumBase12(lines: JournalEntry[], type: string) {

  let total = 0;

  for (const e of lines) {

    if (e.tax?.base12) {
      total += Number(e.tax.base12);
      continue;
    }

    if (type === "18" && isSalesAccount(e.account_code)) {
      total += Number(e.credit ?? 0);
    }

    if (type === "01" && isPurchaseAccount(e.account_code)) {
      total += Number(e.debit ?? 0);
    }

  }

  return total;
}

function sumBase0(lines: JournalEntry[]) {

  return lines.reduce(
    (acc, e) => acc + Number(e.tax?.base0 ?? 0),
    0
  );
}

function sumIva(lines: JournalEntry[], type: string) {

  let total = 0;

  for (const e of lines) {

    if (e.tax?.iva) {
      total += Number(e.tax.iva);
      continue;
    }

    if (type === "18" && isIvaSalesAccount(e.account_code)) {
      total += Number(e.credit ?? 0);
    }

    if (type === "01" && isIvaPurchaseAccount(e.account_code)) {
      total += Number(e.debit ?? 0);
    }

  }

  return total;
}

/* =============================================================================
   PARTY DETECTION
============================================================================= */

function inferRuc(lines: JournalEntry[], type: string) {

  if (type === "18") {

    return (
      lines.find((e) => e.customerRUC)?.customerRUC ||
      ""
    );

  }

  return (
    lines.find((e) => e.issuerRUC)?.issuerRUC ||
    ""
  );
}

function inferName(lines: JournalEntry[], type: string) {

  if (type === "18") {

    return (
      lines.find((e) => e.customer_name)?.customer_name ||
      "CLIENTE"
    );

  }

  return (
    lines.find((e) => e.issuerName)?.issuerName ||
    "PROVEEDOR"
  );
}

/* =============================================================================
   MAIN FUNCTION
============================================================================= */

export function buildAtsDocuments(
  entries: JournalEntry[] | undefined,
  entityId: string,
  period: string
): AtsDocument[] {

  const safeEntries = Array.isArray(entries) ? entries : [];

  const grouped: Record<string, JournalEntry[]> = {};

  /* --------------------------------------------------------------------------
     GROUP JOURNAL LINES BY INVOICE
  -------------------------------------------------------------------------- */

  for (const e of safeEntries) {

    if (e.entityId !== entityId) continue;
    if (!e.invoice_number) continue;
    if (!e.date?.startsWith(period)) continue;
    if (e.source === "initial") continue;

    const partyRuc =
      e.issuerRUC ||
      e.customerRUC ||
      "";

    const key = `${e.invoice_number}-${partyRuc || "SIN-RUC"}`;

    if (!grouped[key]) grouped[key] = [];

    grouped[key].push(e);

  }

  /* --------------------------------------------------------------------------
     BUILD ATS DOCUMENTS
  -------------------------------------------------------------------------- */

  const documents: AtsDocument[] = [];

  for (const [key, lines] of Object.entries(grouped)) {

    const type = inferDocumentType(lines);

    const first = lines[0];

    const ruc = inferRuc(lines, type);
    const razonSocial = inferName(lines, type);

    const retenciones = lines.flatMap((e) =>
      Array.isArray(e.tax?.retenciones)
        ? e.tax!.retenciones.map((r) => ({
            taxType: r.taxType,
            code: r.code,
            percentage: Number(r.percentage ?? 0),
            base: Number(r.base ?? 0),
            amount: Number(r.amount ?? 0),
          }))
        : []
    );

    documents.push({

      id: key,

      entityId,

      period,

      documentType: type,

      establishment: "001",

      emissionPoint: "001",

      sequential: first.invoice_number,

      authorizationNumber: first.tax?.authorizationNumber,

      date: first.date,

      ruc,

      razonSocial,

      base12: sumBase12(lines, type),

      base0: sumBase0(lines),

      iva: sumIva(lines, type),

      ice: lines.reduce(
        (acc, e) => acc + Number(e.tax?.ice ?? 0),
        0
      ),

      retenciones: retenciones.length ? retenciones : undefined,

      journalEntryIds: lines
        .map((e) => e.id)
        .filter(Boolean) as string[]

    });

  }

  return documents;

}