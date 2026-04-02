// ============================================================================
// CONTILISTO — CENTRAL FILTER ENGINE
// - Safe date filtering (no timezone issues)
// - Excludes initial balances when required
// - Reusable across ALL modules
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";

export interface FilterOptions {
  startDate?: string;
  endDate?: string;
  excludeInitial?: boolean;
}

const normalizeDate = (date?: string) => {
  if (!date) return "";
  return date.split("T")[0]; // removes time safely
};

export function filterEntries(
  entries: JournalEntry[],
  options: FilterOptions = {}
): JournalEntry[] {
  const { startDate, endDate, excludeInitial = true } = options;

  const from = startDate ? normalizeDate(startDate) : null;
  const to = endDate ? normalizeDate(endDate) : null;

  return entries.filter((e) => {
    if (!e.date) return false;

    const d = normalizeDate(e.date);

    // Date filtering
    if (from && d < from) return false;
    if (to && d > to) return false;

    // Accounting rule: exclude initial balances if required
    if (excludeInitial && e.source === "initial") return false;

    return true;
  });
}