import { JournalEntry } from "@/types/JournalEntry";
import { AtsDocument } from "@/types/atsDocument";

export function buildAtsDocuments(
  entries: JournalEntry[],
  entityId: string,
  period: string
): AtsDocument[] {

  const docs: Record<string, AtsDocument> = {};

  for (const e of entries) {

    if (e.entityId !== entityId) continue;
    if (!e.invoice_number) continue;
    if (!e.date?.startsWith(period)) continue;

    const key = `${e.invoice_number}-${e.issuerRUC}`;

    if (!docs[key]) {

      docs[key] = {

        id: key,
        entityId,
        period,

        documentType: e.tax?.documentType || "01",

        sequential: e.invoice_number,

        authorizationNumber: e.tax?.authorizationNumber,

        date: e.date,

        ruc: e.issuerRUC || "",
        razonSocial: e.issuerName || "",

        base12: 0,
        base0: 0,
        iva: 0,

        journalEntryIds: []

      };

    }

    const doc = docs[key];

    doc.journalEntryIds.push(e.id || "");

    const debit = Number(e.debit || 0);
    const credit = Number(e.credit || 0);

    if (e.tax?.base12) doc.base12 += e.tax.base12;
    if (e.tax?.base0) doc.base0 += e.tax.base0;
    if (e.tax?.iva) doc.iva += e.tax.iva;

  }

  return Object.values(docs);

}