import type { JournalEntry } from "../types/JournalEntry";

export function groupAccountsByType(entries: JournalEntry[]) {
  const grouped: Record<"activo" | "pasivo" | "patrimonio", any[]> = {
    activo: [],
    pasivo: [],
    patrimonio: [],
  };

  const accounts: Record<string, {
    code: string;
    name: string;
    debit: number;
    credit: number;
    balance: number;
  }> = {};

  entries.forEach((e) => {
    if (!e.account_code || !e.account_name) return;

    if (!accounts[e.account_code]) {
      accounts[e.account_code] = {
        code: e.account_code,
        name: e.account_name,
        debit: 0,
        credit: 0,
        balance: 0,
      };
    }
    accounts[e.account_code].debit += e.debit || 0;
    accounts[e.account_code].credit += e.credit || 0;
  });

  Object.values(accounts).forEach((acc) => {
    acc.balance = acc.debit - acc.credit;
    const type = accountTypeByCode(acc.code);
    grouped[type].push(acc);
  });

  return grouped;
}

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