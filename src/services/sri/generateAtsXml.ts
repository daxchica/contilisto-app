// ============================================================================
// src/services/sri/generateAtsXml.ts
// CONTILISTO — ATS XML Generator
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";
import { buildAtsDocuments } from "./atsDocumentAggregator";
import { buildAtsXml } from "./atsXmlBuilder";

type GenerateAtsXmlParams = {
  entries: JournalEntry[] | undefined;
  entityId: string;
  period: string;
  ruc: string;
  razonSocial: string;
};

export async function generateAtsXml({
  entries,
  entityId,
  period,
  ruc,
  razonSocial,
}: GenerateAtsXmlParams): Promise<string> {
  const documents = buildAtsDocuments(entries, entityId, period);

  return buildAtsXml({
    documents,
    period,
    ruc,
    razonSocial,
  });
}