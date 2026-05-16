// ============================================================================
// src/utils/sriXmlToEntries.ts
// CONTILISTO — Build journal entries from a parsed SRI XML invoice.
//
// Mirrors account codes used by sriTxtToEntries / extract-invoice-vision.
// Handles both EXPENSE (purchase) and INCOME (sale) directions.
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";
import type { SriXmlInvoice } from "@/utils/parseSriXml";

// ---------------------------------------------------------------------------
// DEFAULT ACCOUNTS
// ---------------------------------------------------------------------------

const ACCOUNT = {
  // Expense side
  expenseDefault:     "502020101",
  expenseDefaultName: "GASTOS GENERALES DE OFICINA",
  ivaCredit:     "1330101",
  ivaCreditName: "IVA crédito en compras",
  ap:     "201030102",
  apName: "Cuentas por pagar",

  // Income side
  ar:          "101020101",
  arName:      "Cuentas por cobrar clientes",
  incomeDefault:     "401010101",
  incomeDefaultName: "VENTAS",
  ivaCollected:     "201050101",
  ivaCollectedName: "IVA ventas por pagar",
};

// ---------------------------------------------------------------------------
// MAIN BUILDER
// ---------------------------------------------------------------------------

/**
 * @param xml         Parsed XML invoice data
 * @param entityId    Firestore entity ID
 * @param uid         Auth UID
 * @param entityRUC   The company's own RUC — used to determine expense vs income
 * @param expenseCode Override expense account (from contextual hint)
 * @param expenseName Override expense account name
 */
export function sriXmlToEntries(
  xml: SriXmlInvoice,
  entityId: string,
  uid: string,
  entityRUC: string,
  expenseCode = ACCOUNT.expenseDefault,
  expenseName = ACCOUNT.expenseDefaultName
): JournalEntry[] {
  const transactionId = crypto.randomUUID();
  const isExpense = xml.issuerRUC !== entityRUC; // buying from them
  const subtotal = +(xml.taxableBase + xml.taxable0).toFixed(2);

  const desc = isExpense
    ? `Factura ${xml.invoice_number} — ${xml.issuerName}`
    : `Factura ${xml.invoice_number} — ${xml.buyerName}`;

  const shared: Partial<JournalEntry> = {
    entityId,
    uid,
    transactionId,
    transactionType: "invoice",
    documentNature: isExpense ? "purchase" : "sale",
    date: xml.invoiceDate,
    description: desc,
    invoice_number: xml.invoice_number,
    issuerRUC: xml.issuerRUC,
    issuerName: xml.issuerName,
    supplier_ruc: isExpense ? xml.issuerRUC : undefined,
    supplier_name: isExpense ? xml.issuerName : undefined,
    source: "ai" as const,
  };

  const entries: JournalEntry[] = [];

  if (isExpense) {
    // ── PURCHASE ────────────────────────────────────────────────────────────

    // Debit: Expense
    entries.push({
      ...shared,
      id: crypto.randomUUID(),
      account_code: expenseCode,
      account_name: expenseName,
      debit: subtotal,
      credit: 0,
      tax: {
        document: {
          type: "01",
          authorization: xml.accessKey,
        },
        supplier: {
          ruc: xml.issuerRUC,
          name: xml.issuerName,
          identificationType: "04",
        },
        bases: [
          {
            rate: xml.taxRate,
            base: xml.taxableBase,
            iva: xml.iva,
          },
        ],
        total: xml.total,
      },
    } as JournalEntry);

    // Debit: IVA crédito tributario
    if (xml.iva > 0) {
      entries.push({
        ...shared,
        id: crypto.randomUUID(),
        account_code: ACCOUNT.ivaCredit,
        account_name: ACCOUNT.ivaCreditName,
        debit: xml.iva,
        credit: 0,
      } as JournalEntry);
    }

    // Credit: Accounts payable
    entries.push({
      ...shared,
      id: crypto.randomUUID(),
      account_code: ACCOUNT.ap,
      account_name: ACCOUNT.apName,
      debit: 0,
      credit: xml.total,
    } as JournalEntry);
  } else {
    // ── SALE ────────────────────────────────────────────────────────────────

    // Debit: Accounts receivable
    entries.push({
      ...shared,
      id: crypto.randomUUID(),
      account_code: ACCOUNT.ar,
      account_name: ACCOUNT.arName,
      debit: xml.total,
      credit: 0,
    } as JournalEntry);

    // Credit: Income
    entries.push({
      ...shared,
      id: crypto.randomUUID(),
      account_code: ACCOUNT.incomeDefault,
      account_name: ACCOUNT.incomeDefaultName,
      debit: 0,
      credit: subtotal,
    } as JournalEntry);

    // Credit: IVA collected
    if (xml.iva > 0) {
      entries.push({
        ...shared,
        id: crypto.randomUUID(),
        account_code: ACCOUNT.ivaCollected,
        account_name: ACCOUNT.ivaCollectedName,
        debit: 0,
        credit: xml.iva,
      } as JournalEntry);
    }
  }

  return entries;
}
