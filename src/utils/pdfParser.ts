// src/utils/pdfParser.ts

export async function parseBalanceSheetPDF(file: File) {
  // Placeholder for real PDF parsing
  return [
    { account_code: "1.1.01.01", account_name: "Caja", debit: 1000, credit: 0 },
    { account_code: "2.1.01.01", account_name: "Proveedores", debit: 0, credit: 500 }
  ];
}