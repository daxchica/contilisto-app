// utils/reporting.ts

interface JournalEntry {
  accountCode?: string;
  desceiption?: string;
  debit: number;
  credit: number;
}

function isValidEntry(entry: any): entry is JournalEntry {
  return entry && typeof entry.accountCode === 'string' && typeof entry.debit === 'number' && typeof entry.credit ==='number';
}

export function getAccountsReceivable(journalEntries: any[]) {
  return journalEntries
    .filter(isValidEntry)
    .filter((e) => e.accountCode?.startsWith("1.01.01"))
    .reduce((acc: Record<string, number>, entry) => {
      const name = entry.description?.trim() || "Cliente desconocido";
      acc[name] = (acc[name] || 0) + entry.debit - entry.credit;
      return acc;
    }, {});
}

export function getAccountsPayable(journalEntries: any[]) {
  return journalEntries
  .filter(isValidEntry)
    .filter((e) => e.accountCode.startsWith("2.01.01"))
    .reduce((acc: Record<string, number>, entry) => {
      const name = entry.description?.trim || "Proveedor desconocido";
      acc[name] = (acc[name] || 0) + entry.credit - entry.debit;
      return acc;
    }, {});
}