import type { JournalEntry } from "@/types/JournalEntry";

export function applyBalanceDateLogic(
  entries: JournalEntry[],
  initialBalanceDate: string, // yyyy-mm-dd
  fromDate?: string,
  toDate?: string
) {
  return entries.filter(e => {
    // 1️⃣ Initial balance logic
    if (e.source === "initial") {
      if (!e.date) return true; // legacy safety
      return e.date <= initialBalanceDate;
    }

    // 2️⃣ Regular journal entries
    if (!fromDate || !toDate) return true;
    if (!e.date) return false;

    return e.date >= fromDate && e.date <= toDate;
  });
}