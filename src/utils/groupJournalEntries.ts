// utils/groupJournalEntries.ts
import { JournalEntry } from "../types/JournalEntry";

export function groupEntriesByAccount(entries: JournalEntry[]) {
  const grouped: Record<string, { debit: number; credit: number; initial: number }> = {};

  for (const entry of entries) {
    const code = entry.account_code;
    if (!grouped[code]) {
      grouped[code] = { debit: 0, credit: 0, initial: 0 };
    }

    if (entry.source === "initial") {
      grouped[code].initial += (entry.debit ?? 0) - (entry.credit ?? 0);
    } else {
      grouped[code].debit += entry.debit ?? 0;
      grouped[code].credit += entry.credit ?? 0;
    }
  }
  return grouped;
}