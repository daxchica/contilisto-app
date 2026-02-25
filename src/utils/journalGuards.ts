// src/utils/journalGuards.ts
import type { JournalEntry } from "@/types/JournalEntry";

/**
 * True if the entity has at least one Initial Balance entry.
 * We keep this logic centralized so all reports behave the same.
 */
export function hasInitial(entries: JournalEntry[]): boolean {
  return entries.some((e) => e.source === "initial");
}

export function getInitialBalanceDate(
  entries: JournalEntry[],
  entityId: string
): string | null {
  const iso = (s?: string) =>
    typeof s === "string" ? s.slice(0, 10) : "";

  const dates = entries
    .filter(
      (e) =>
        e.entityId === entityId &&
        e.source === "initial" &&
        iso(e.date)
    )
    .map((e) => iso(e.date))
    .sort();

  return dates.length ? dates[0] : null;
}