// ============================================================================
// src/services/sri/generateAtsXml.ts
// CONTILISTO — ATS XML Generator
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

  if (!ruc) {
    throw new Error("generateAtsXml: RUC is required");
  }

  if (!razonSocial) {
    throw new Error("generateAtsXml: razonSocial is required");
  }

  const safeLedger = safeArray(ledger);

  /* --------------------------------------------------------------------------
     BUILD DOCUMENTS
  -------------------------------------------------------------------------- */

  const documents: AtsDocument[] = buildAtsDocuments(
    safeLedger,
    entityId,
    period
  );

  /* --------------------------------------------------------------------------
     VALIDATION — BUSINESS RULES
  -------------------------------------------------------------------------- */

  if (documents.length === 0) {
    console.warn("⚠️ ATS WARNING: No documents generated for period", {
      entityId,
      period,
      ledgerSize: safeLedger.length,
    });
  }

  /* --------------------------------------------------------------------------
     DEBUG (VERY IMPORTANT FOR SRI)
  -------------------------------------------------------------------------- */

  console.log("📊 ATS GENERATION", {
    period,
    entityId,
    documents: documents.length,
  });

  /* --------------------------------------------------------------------------
     XML BUILD
  -------------------------------------------------------------------------- */

  const xml = buildAtsXml({
    documents,
    period,
    ruc,
    razonSocial,
  });

  /* --------------------------------------------------------------------------
     FINAL SAFETY CHECK
  -------------------------------------------------------------------------- */

  if (!xml || xml.length < 50) {
    throw new Error("ATS XML generation failed: empty or invalid output");
  }

  return xml;

}