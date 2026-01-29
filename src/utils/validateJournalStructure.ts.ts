import type { JournalEntry } from "@/types/JournalEntry";

type InvoiceType = "sale" | "expense";

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

  // 1️⃣ Mathematical balance (non-negotiable)
  if (Math.abs(debit - credit) >= 0.01) return false;

  // --- Common helpers ---
  const hasDebit = (prefix: string) =>
    rows.some(r => (r.debit ?? 0) > 0 && r.account_code?.startsWith(prefix));

  const hasCredit = (prefix: string) =>
    rows.some(r => (r.credit ?? 0) > 0 && r.account_code?.startsWith(prefix));

  // 2️⃣ Invoice-type specific structure
  if (invoiceType === "sale") {
    const hasClient = hasDebit("13");      // Clientes
    const hasRevenue = hasCredit("4");     // Ingresos
    const hasIVA = hasCredit("213");       // IVA débito en ventas

    return hasClient && hasRevenue && hasIVA;
  }

  // EXPENSE
  const hasExpense = hasDebit("5");        // Gastos
  const hasIVA = hasDebit("133");           // IVA crédito en compras
  const hasAP = hasCredit("201");           // Proveedores

  return hasExpense && hasAP && hasIVA;
}