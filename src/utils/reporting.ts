// utils/reporting.ts
export function getAccountsReceivable(journalEntries) {
  return journalEntries
    .filter(e => e.accountCode.startsWith("1.01.01"))
    .reduce((acc, entry) => {
      const name = entry.description || "Cliente desconocido";
      acc[name] = (acc[name] || 0) + entry.debit - entry.credit;
      return acc;
    }, {});
}

export function getAccountsPayable(journalEntries) {
  return journalEntries
    .filter(e => e.accountCode.startsWith("2.01.01"))
    .reduce((acc, entry) => {
      const name = entry.description || "Proveedor desconocido";
      acc[name] = (acc[name] || 0) + entry.credit - entry.debit;
      return acc;
    }, {});
}