import type { JournalEntry } from "@/types/JournalEntry";
import type { InitialBalance } from "@/services/initialBalanceService";

export function initialBalancesToJournalEntries(
  balances: Record<string, InitialBalance>,
  entityId: string
): JournalEntry[] {
  return Object.values(balances).map((b) => ({
    id: `initial-${b.account_code}`,
    entityId,
    account_code: b.account_code,
    account_name: b.account_name,
    debit: b.type === "debit" ? b.initial_balance : 0,
    credit: b.type === "credit" ? b.initial_balance : 0,
    date: "1900-01-01",              // canonical opening date
    source: "initial",               // 🔥 IMPORTANT FLAG
    transactionId: "INITIAL_BALANCE",
    description: "Saldo inicial",
  }));
}