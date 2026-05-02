// ============================================================================
// src/services/sri/generateAtsXml.ts
// CONTILISTO — ATS XML Generator (PRODUCTION HARDENED)
// ============================================================================

import type { TaxLedgerEntry } from "@/types/TaxLedgerEntry";
import type { AtsDocument } from "@/types/atsDocument";

import { buildAtsDocuments } from "./atsDocumentAggregator";
import { buildAtsXml } from "./atsXmlBuilder";

/* =============================================================================
   TYPES
============================================================================= */

type GenerateAtsXmlParams = {
  ledger: TaxLedgerEntry[];
  entityId: string;
  period: string;
  ruc: string;
  razonSocial: string;
};

/* =============================================================================
   HELPERS
============================================================================= */

function validatePeriod(period: string) {
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error(`Invalid ATS period format: ${period}`);
  }
}

function safeArray<T>(arr?: T[]): T[] {
  return Array.isArray(arr) ? arr : [];
}

function isValidRuc(ruc?: string): boolean {
  if (!ruc) return false;
  const clean = String(ruc).trim();
  return /^\d{10,13}$/.test(clean);
}

function isValidIsoDate(date?: string): boolean {
  if (!date) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function normalizeText(value?: string): string {
  return String(value ?? "").trim();
}

function normalizeDocuments(docs: AtsDocument[], period: string): AtsDocument[] {
  return docs.map((d) => {
    const safeRuc = isValidRuc(d.counterpartyRUC)
      ? normalizeText(d.counterpartyRUC)
      : "9999999999999";

    const safeName =
      normalizeText(d.counterpartyName) || "CONSUMIDOR FINAL";

    return {
      ...d,
      transactionId: normalizeText(d.transactionId),
      entityId: normalizeText(d.entityId),
      period: normalizeText(d.period) || period,

      documentType: normalizeText(d.documentType) || "01",
      documentNumber: normalizeText(d.documentNumber),
      authorizationNumber: normalizeText(d.authorizationNumber),

      establishment: normalizeText(d.establishment) || "001",
      emissionPoint: normalizeText(d.emissionPoint) || "001",
      sequential:
        normalizeText(d.sequential) || normalizeText(d.documentNumber),

      counterpartyRUC: safeRuc,
      counterpartyName: safeName,

      journalEntryIds: Array.isArray(d.journalEntryIds)
        ? d.journalEntryIds.filter(Boolean)
        : [],
    };
  });
}

function filterValidDocuments(docs: AtsDocument[], period: string): AtsDocument[] {
  return docs.filter((d) => {
    const validTransaction = !!d.transactionId;
    const validDate = isValidIsoDate(d.date);
    const validDoc = !!d.documentNumber;
    const validType = d.type === "sale" || d.type === "purchase";
    const validPeriod = d.period === period;

    if (!validTransaction || !validDate || !validDoc || !validType || !validPeriod) {
      console.warn("⚠️ ATS SKIPPED INVALID DOC", {
        transactionId: d.transactionId,
        documentNumber: d.documentNumber,
        date: d.date,
        type: d.type,
        period: d.period,
      });
      return false;
    }

    return true;
  });
}

/* =============================================================================
   MAIN FUNCTION
============================================================================= */

export async function generateAtsXml({
  ledger,
  entityId,
  period,
  ruc,
  razonSocial,
}: GenerateAtsXmlParams): Promise<string> {
  /* --------------------------------------------------------------------------
     VALIDATION
  -------------------------------------------------------------------------- */

  validatePeriod(period);

  if (!entityId) {
    throw new Error("generateAtsXml: entityId is required");
  }

  if (!isValidRuc(ruc)) {
    throw new Error(`generateAtsXml: invalid RUC (${ruc})`);
  }

  if (!normalizeText(razonSocial)) {
    throw new Error("generateAtsXml: razonSocial is required");
  }

  const safeLedger = safeArray(ledger);

  /* --------------------------------------------------------------------------
     BUILD DOCUMENTS
  -------------------------------------------------------------------------- */

  let documents: AtsDocument[] = buildAtsDocuments(
    safeLedger,
    entityId,
    period
  );

  /* --------------------------------------------------------------------------
     VALIDATION — BUSINESS RULES
  -------------------------------------------------------------------------- */

  if (documents.length === 0) {
    console.warn("⚠️ ATS WARNING: No documents generated", {
      entityId,
      period,
      ledgerSize: safeLedger.length,
    });
  }

  /* --------------------------------------------------------------------------
     NORMALIZE + FILTER
  -------------------------------------------------------------------------- */

  documents = normalizeDocuments(documents, period);
  documents = filterValidDocuments(documents, period);

  /* --------------------------------------------------------------------------
     DEBUG (CRITICAL FOR SRI)
  -------------------------------------------------------------------------- */

  console.log("📊 ATS GENERATION", {
    period,
    entityId,
    totalDocuments: documents.length,
    purchases: documents.filter((d) => d.type === "purchase").length,
    sales: documents.filter((d) => d.type === "sale").length,
  });

  console.log("📄 ATS SAMPLE DOC", documents[0]);

  /* --------------------------------------------------------------------------
     XML BUILD
  -------------------------------------------------------------------------- */

  const xml = buildAtsXml({
    documents,
    period,
    ruc: normalizeText(ruc),
    razonSocial: normalizeText(razonSocial),
  });

  /* --------------------------------------------------------------------------
     FINAL SAFETY CHECK
  -------------------------------------------------------------------------- */

  if (!xml || xml.length < 50) {
    throw new Error("ATS XML generation failed: empty or invalid output");
  }

  if (!xml.includes("<iva>") || !xml.includes("</iva>")) {
    throw new Error("ATS XML generation failed: malformed root node");
  }

  /* --------------------------------------------------------------------------
     FINAL DEBUG
  -------------------------------------------------------------------------- */

  console.log("✅ ATS XML GENERATED LENGTH:", xml.length);

  return xml;
}