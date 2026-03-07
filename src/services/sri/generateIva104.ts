// ============================================================================
// src/services/sri/generateIva104.ts
// CONTILISTO — IVA 104 Generator
// ============================================================================

import { runTaxEngine } from "./taxEngineService";
import type { JournalEntry } from "@/types/JournalEntry";

export async function generateIva104(
  entries: JournalEntry[],
  entityId: string,
  period: string
) {

  const result = await runTaxEngine(
    entries,
    entityId,
    period
  );

  return result.ivaSummary;

}