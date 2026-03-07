import { runTaxEngine } from "@/services/sri/taxEngineService";
import type { JournalEntry } from "@/types/JournalEntry";

export async function generateIva104(
  entries: JournalEntry[] | undefined,
  entityId: string,
  period: string
) {

    const safeEntries = Array.isArray(entries) ? entries : [];

    const result = await runTaxEngine(
        safeEntries,
        entityId,
        period
    );

    return result.ivaSummary;
}