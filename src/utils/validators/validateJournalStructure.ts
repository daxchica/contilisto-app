import type { JournalEntry } from "@/types/JournalEntry";

type InvoiceType = "sale" | "expense";

/**
 * Validates:
 * 1) Mathematical balance
 * 2) Minimum structural rules (sale / expense)
 */
export function validateJournalStructure(
  rows: Pick<JournalEntry, "account_code" | "debit" | "credit">[],
  invoiceType: InvoiceType
): boolean {
  const debit = Number(
    rows.reduce((s, r) => s + Number(r.debit ?? 0), 0).toFixed(2)
  );
  const credit = Number(
    rows.reduce((s, r) => s + Number(r.credit ?? 0), 0).toFixed(2)
  );

  // 1️⃣ Must balance
  if (Math.abs(debit - credit) >= 0.01) return false;

  // 2️⃣ Structural sanity (minimal, safe)
  if (invoiceType === "sale") {
    // must have income (7xxx) credit
    return rows.some(
      r => r.account_code?.startsWith("7") && Number(r.credit) > 0
    );
  }

  if (invoiceType === "expense") {
    // must have expense or asset debit (5 / 1)
    return rows.some(
      r =>
        (r.account_code?.startsWith("5") ||
          r.account_code?.startsWith("1")) &&
        Number(r.debit) > 0
    );
  }

  return true;
}