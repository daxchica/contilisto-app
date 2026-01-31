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
          balance: number;
        }
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
          balance: 0,
        };
      }

      acc[key].balance += debit - credit;

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
          balance: number;
        }
      >
    >((acc, entry) => {
      const debit = n2(entry.debit);
      const credit = n2(entry.credit);

      const supplierName =
        norm((entry as any).supplier_name) ||
        norm((entry as any).supplierName) ||
        "PROVEEDOR";

      if (!acc[supplierName]) {
        acc[supplierName] = {
          supplierName,
          balance: 0,
        };
      }

      acc[supplierName].balance += credit - debit;

      return acc;
    }, {});
}