// --- src/utils/accountMapper.ts ---

import { JournalEntry } from "../types/JournalEntry";


export function mapToJournalEntries(invoice: InvoiceData): JournalEntry[] {
  const { date, vendor, client, classification, subtotal, tax, total, invoice_number } = invoice;

  const isSale = classification === "venta_servicios"
  const descriptionText = `Factura ${invoice_number} a ${client} por ${classification.replace("_", " ")}`;

  if (isSale) {
    return [
      {
        date,
        account_code: "1.1.03.01",
        account_name: "Cuentas por cobrar clientes",
        debit: subtotal + tax,
        credit: 0,
      },
      {
        date,
        account_code: "4.1.01.01",
        account_name: "Ingresos por servicios profesionales",
        debit: 0,
        credit: subtotal,
      },
      {
        date,
        account_code: "2.1.03.01",
        account_name: "IVA por pagar",
        debit: 0,
        credit: tax,
        description: descriptionText,
      }
    ];
  }

  // Default fallback entry for unclassified
  return [
    {
      date,
      account_code: "1.1.99.99",
      account_name: "Cuenta no definida (provisional)",
      debit: total,
      credit: 0,
    },
    {
      date,
      account_code: "2.1.99.99",
      account_name: "Contrapartida no definida (provisional)",
      debit: 0,
      credit: total,
      description: descriptionText
    }
  ];
}