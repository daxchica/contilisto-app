// ============================================================================
// src/services/sri/atsNormalizer.ts
// Converts accounting entries into ATS normalized transactions
// ============================================================================

import { JournalEntry } from "@/types/JournalEntry";
import { AtsNormalizedData, AtsTransaction } from "@/types/ats";

const samePeriod = (date?: string, period?: string) =>
  date?.slice(0, 7) === period;

export function normalizeAtsTransactions(
  entries: JournalEntry[],
  entityId: string,
  period: string
): AtsNormalizedData {

  const compras: AtsTransaction[] = [];
  const ventas: AtsTransaction[] = [];
  const retenciones: AtsTransaction[] = [];
  const anulados: AtsTransaction[] = [];

  for (const e of entries) {

    if (!e) continue;

    if (e.entityId !== entityId) continue;

    if (!samePeriod(e.date, period)) continue;

    const debit = Number(e.debit || 0);
    const credit = Number(e.credit || 0);

    // -----------------------------
    // SALES (INGRESOS)
    // -----------------------------

    if (e.account_code.startsWith("4")) {

      ventas.push({

        period,

        type: "venta",

        date: e.date,

        ruc: e.customerRUC || "",

        razonSocial: e.customer_name || "",

        documentType: "01",

        sequential: e.invoice_number,

        baseNoGraIva: 0,

        baseImponible: 0,

        baseImpGrav: credit,

        montoIva: 0,

      });

    }

    // -----------------------------
    // PURCHASES
    // -----------------------------

    if (e.account_code.startsWith("5") || e.account_code.startsWith("6")) {

      compras.push({

        period,

        type: "compra",

        date: e.date,

        ruc: e.issuerRUC || "",

        razonSocial: e.issuerName || "",

        documentType: "01",

        sequential: e.invoice_number,

        baseNoGraIva: 0,

        baseImponible: debit,

        baseImpGrav: 0,

        montoIva: 0,

      });

    }

    // -----------------------------
    // RETENTIONS
    // -----------------------------

    if (e.account_code.startsWith("20102")) {

      retenciones.push({

        period,

        type: "retencion",

        date: e.date,

        ruc: e.issuerRUC || "",

        razonSocial: e.issuerName || "",

        documentType: "07",

        sequential: e.invoice_number,

        baseNoGraIva: 0,

        baseImponible: debit,

        baseImpGrav: 0,

        montoIva: 0,

      });

    }

  }

  return {

    compras,

    ventas,

    retenciones,

    anulados,

  };

}