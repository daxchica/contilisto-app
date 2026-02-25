// utils/reporting.ts

import { JournalEntry } from "../types/JournalEntry";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const norm = (v?: string) => (v || "").trim();

const n2 = (v: any) =>
  Number.isFinite(Number(v)) ? Number(Number(v).toFixed(2)) : 0;

/**
 * Ecuador COA – Accounts Receivable
 * - 10101… Clientes
 * - 113…   Cuentas por Cobrar
 * - 1301…  Otras CxC
 */
const RECEIVABLE_PREFIXES = ["10101", "113", "1301"];

/* -------------------------------------------------------------------------- */
/* Type guards                                                                 */
/* -------------------------------------------------------------------------- */

function isJournalEntry(entry: any): entry is JournalEntry {
  return (
    entry &&
    typeof entry.account_code === "string" &&
    ("debit" in entry || "credit" in entry)
  );
}

/* -------------------------------------------------------------------------- */
/* Shared aggregate type                                                       */
/* -------------------------------------------------------------------------- */

type ARAPAggregate = {
  initialBalance: number;
  debit: number;
  credit: number;
  balance: number;
};

/* -------------------------------------------------------------------------- */
/* Accounts Receivable                                                         */
/* -------------------------------------------------------------------------- */

export function getAccountsReceivable(journalEntries: any[]) {
  return journalEntries
    .filter(isJournalEntry)
    .filter((e) =>
      RECEIVABLE_PREFIXES.some((p) =>
        e.account_code.replace(/\./g, "").startsWith(p)
      )
    )
    .reduce<
      Record<
        string,
        {
          customerName: string;
          customerRUC: string;
        } & ARAPAggregate
      >
    >((acc, entry) => {
      const debit = n2(entry.debit);
      const credit = n2(entry.credit);

      const customerName =
        norm((entry as any).customer_name) ||
        norm((entry as any).customerName) ||
        "CONSUMIDOR FINAL";

      const customerRUC =
        norm((entry as any).customer_ruc) ||
        norm((entry as any).customerRUC) ||
        "9999999999999";

      const key = `${customerRUC}::${customerName}`;

      if (!acc[key]) {
        acc[key] = {
          customerName,
          customerRUC,
          initialBalance: 0,
          debit: 0,
          credit: 0,
          balance: 0,
        };
      }

      if (entry.source === "initial") {
        acc[key].initialBalance += debit - credit;
      } else {
        acc[key].debit += debit;
        acc[key].credit += credit;
      }

      acc[key].balance =
        acc[key].initialBalance + acc[key].debit - acc[key].credit;

      return acc;
    }, {});
}

/* -------------------------------------------------------------------------- */
/* Accounts Payable (mirror logic)                                                             */
/* -------------------------------------------------------------------------- */

export function getAccountsPayable(journalEntries: any[]) {
  return journalEntries
    .filter(isJournalEntry)
    .filter((e) =>
      e.account_code.replace(/\./g, "").startsWith("201")
    )
    .reduce<
      Record<
        string,
        {
          supplierName: string;
          supplierRUC: string;
        } & ARAPAggregate
      >
    >((acc, entry) => {
      const debit = n2(entry.debit);
      const credit = n2(entry.credit);

      const supplierName =
        norm((entry as any).supplier_name) ||
        norm((entry as any).supplierName) ||
        "PROVEEDOR";

      const supplierRUC =
        norm((entry as any).supplier_ruc) ||
        norm((entry as any).supplierRUC) ||
        "9999999999999";

      const key = `${supplierRUC}::${supplierName}`;

      if (!acc[key]) {
        acc[key] = {
          supplierName,
          supplierRUC,
          initialBalance: 0,
          debit: 0,
          credit: 0,
          balance: 0,
        };
      }

      if (entry.source === "initial") {
        acc[key].initialBalance += debit - credit;
      } else {
        acc[key].debit += debit;
        acc[key].credit += credit;
      }

      // PASIVO formula
      acc[key].balance =
        acc[key].initialBalance -
        acc[key].debit +
        acc[key].credit;

      return acc;
    }, {});
}