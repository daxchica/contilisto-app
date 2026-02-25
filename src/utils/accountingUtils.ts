import type { JournalEntry } from "../types/JournalEntry";

/* ============================================================================
 * TYPES
 * ========================================================================== */

export type AccountAggregate = {
  code: string;
  name: string;
  initialBalance: number;
  debit: number;
  credit: number;
  balance: number;
};

export type AccountGroup = "activo" | "pasivo" | "patrimonio";

/* ============================================================================
 * MAIN AGGREGATOR
 * ========================================================================== */

export function groupAccountsByType(entries: JournalEntry[]) {
  const grouped: Record<"activo" | "pasivo" | "patrimonio", any[]> = {
    activo: [],
    pasivo: [],
    patrimonio: [],
  };

  const accounts: Record<string, AccountAggregate> = {};

  for (const e of entries) {
    if (!e.account_code || !e.account_name) continue;

    if (!accounts[e.account_code]) {
      accounts[e.account_code] = {
        code: e.account_code,
        name: e.account_name,
        initialBalance: 0,
        debit: 0,
        credit: 0,
        balance: 0,
      };
    }
    const debit = e.debit ?? 0;
    const credit = e.credit ?? 0;

    if (e.source === "initial") {
      accounts[e.account_code].initialBalance += debit - credit;
    } else {
      accounts[e.account_code].debit += debit;
      accounts[e.account_code].credit += credit;
    }
  }

  Object.values(accounts).forEach((acc) => {
    const type = accountTypeByCode(acc.code);

    // 🔐 Accounting-correct balance calculation
    if (type === "activo") {
      acc.balance = acc.initialBalance + acc.debit - acc.credit;
    } else {
      // pasivo + patrimonio
      acc.balance = acc.initialBalance - acc.debit + acc.credit;
    }

    grouped[type].push(acc);
  });

  return grouped;
}

/* ============================================================================
 * HELPERS
 * ========================================================================== */

export function accountTypeByCode(code: string | undefined): "activo" | "pasivo" | "patrimonio" {
  if (!code || typeof code !== "string") return "activo";
  if (code.startsWith("1")) return "activo";
  if (code.startsWith("2")) return "pasivo";
  if (code.startsWith("3")) return "patrimonio";
  return "activo";
}

export function formatAmount(amount: number): string {
  return amount.toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}