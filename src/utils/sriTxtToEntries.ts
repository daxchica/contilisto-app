// ============================================================================
// src/utils/sriTxtToEntries.ts
// Converts a parsed SRI TXT row into a balanced set of JournalEntry records.
// Mirrors the same account codes used by extract-invoice-vision.ts
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";
import type { SriTxtRow } from "@/services/parseSriTxt";

const ACCOUNT = {
  expenseDefault: "502020101",
  expenseDefaultName: "GASTOS GENERALES DE OFICINA",
  iva: "1330101",
  ivaName: "IVA crédito en compras",
  ap: "201030102",
  apName: "Cuentas por pagar",
};

export function sriRowToEntries(
  row: SriTxtRow,
  entityId: string,
  uid: string,
  expenseCode = ACCOUNT.expenseDefault,
  expenseName = ACCOUNT.expenseDefaultName
): JournalEntry[] {
  const transactionId = crypto.randomUUID();
  const desc = `Factura ${row.serie} — ${row.issuerName}`;
  const entries: JournalEntry[] = [];

  const taxBase = {
    rate: row.ivaRate,
    base: row.valorSinImpuestos,
    iva: row.iva,
  };

  const shared: Partial<JournalEntry> = {
    entityId,
    uid,
    transactionId,
    transactionType: "invoice",
    documentNature: "purchase",
    date: row.fechaEmision,
    description: desc,
    invoice_number: row.serie,
    issuerRUC: row.issuerRUC,
    issuerName: row.issuerName,
    supplier_ruc: row.issuerRUC,
    supplier_name: row.issuerName,
    source: "ai",
  };

  // Debit: Expense
  entries.push({
    ...shared,
    id: crypto.randomUUID(),
    account_code: expenseCode,
    account_name: expenseName,
    debit: row.valorSinImpuestos,
    credit: 0,
    tax: {
      document: {
        type: "01",
        authorization: row.claveAcceso,
      },
      supplier: {
        ruc: row.issuerRUC,
        name: row.issuerName,
        identificationType: "04",
      },
      bases: [taxBase],
      total: row.total,
    },
  } as JournalEntry);

  // Debit: IVA crédito tributario (only if IVA > 0)
  if (row.iva > 0) {
    entries.push({
      ...shared,
      id: crypto.randomUUID(),
      account_code: ACCOUNT.iva,
      account_name: ACCOUNT.ivaName,
      debit: row.iva,
      credit: 0,
    } as JournalEntry);
  }

  // Credit: Accounts Payable
  entries.push({
    ...shared,
    id: crypto.randomUUID(),
    account_code: ACCOUNT.ap,
    account_name: ACCOUNT.apName,
    debit: 0,
    credit: row.total,
  } as JournalEntry);

  return entries;
}
