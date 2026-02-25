import type { Account } from "@/types/AccountTypes";
import type { JournalEntry } from "@/types/JournalEntry";
import { isLeafAccount } from "./isLeafAccount";

/**
 * Aggregates journal entries by account prefix.
 *
 * RULES:
 * - Only journal rows generate value
 * - Parent accounts NEVER carry their own balance
 * - Prefix match defines hierarchy (Ecuador PUC)
 */
export function aggregateByPrefix(
  accounts: Account[],
  journalRows: JournalEntry[]
): (Account & { debit: number; credit: number })[] {
  return accounts.map(acc => {
    const rows = journalRows.filter(j =>
      j.account_code?.startsWith(acc.code) &&
      j.account_code.length === acc.code.length + 2
    );

    const debit = rows.reduce(
      (sum, r) => sum + (Number(r.debit) || 0),
      0
    );

    const credit = rows.reduce(
      (sum, r) => sum + (Number(r.credit) || 0),
      0
    );

    return {
      ...acc,
      debit,
      credit,
    };
  });
}