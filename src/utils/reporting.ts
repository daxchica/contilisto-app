// utils/reporting.ts

import { JournalEntry } from "../types/JournalEntry";


function isValidEntry(entry: any): entry is JournalEntry {
  return entry && typeof entry.account_code === 'string' && typeof entry.debit === 'number' && typeof entry.credit ==='number';
}

export function getAccountsReceivable(journalEntries: any[]) {
  return journalEntries
    .filter(isValidEntry)
    .filter((e) => e.account_code?.startsWith("1.01.01"))
    .reduce((acc: Record<string, number>, entry) => {
      const name = entry.description?.trim() || "Cliente desconocido";
      acc[name] = (acc[name] || 0) + entry.debit - entry.credit;
      return acc;
    }, {});
}

export function getAccountsPayable(journalEntries: any[]) {
  return journalEntries
  .filter(isValidEntry)
    .filter((e) => e.account_code.startsWith("2.01.01"))
    .reduce((acc: Record<string, number>, entry) => {
      const name = entry.description?.trim || "Proveedor desconocido";
      acc[name] = (acc[name] || 0) + entry.credit - entry.debit;
      return acc;
    }, {});
}