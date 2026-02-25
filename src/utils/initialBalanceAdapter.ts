import type { JournalEntry } from "@/types/JournalEntry";

export function initialBalancesToJournalEntries(
  balances: any[],
  entityId: string,
  effectiveDate: string
): JournalEntry[] {
  return balances
    .filter(b => b.entityId === entityId)
    .map(b => {
      const amount = Number(b.initial_balance || 0);

      return {
        id: `initial-${b.account_code}`,
        entityId,
        account_code: b.account_code,
        account_name: b.account_name,
        debit: amount > 0 ? amount : 0,
        credit: amount < 0 ? Math.abs(amount) : 0,
        date: effectiveDate,
        source: "initial",
      } as JournalEntry;
    });
}