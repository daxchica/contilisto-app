// ============================================================================
// CONTILISTO — FILTER HOOK
// ============================================================================

import { useMemo } from "react";
import type { JournalEntry } from "@/types/JournalEntry";
import { filterEntries, FilterOptions } from "@/utils/filterEntries";

export function useFilteredEntries(
  entries: JournalEntry[],
  options: FilterOptions
) {
  return useMemo(() => {
    return filterEntries(entries, options);
  }, [entries, options.startDate, options.endDate, options.excludeInitial]);
}