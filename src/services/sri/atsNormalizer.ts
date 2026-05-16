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
  // ── Group entries by transactionId so we can aggregate per document ────────
  const txMap = new Map<string, JournalEntry[]>();

  for (const e of entries) {
    if (!e) continue;
    if (e.entityId !== entityId) continue;
    if (!samePeriod(e.date, period)) continue;

    const key = e.transactionId || `${e.date}-${e.invoice_number}-${Math.random()}`;
    if (!txMap.has(key)) txMap.set(key, []);
    txMap.get(key)!.push(e);
  }

  const compras:     AtsTransaction[] = [];
  const ventas:      AtsTransaction[] = [];
  const retenciones: AtsTransaction[] = [];
  const anulados:    AtsTransaction[] = [];

  for (const [, lines] of txMap) {
    if (!lines.length) continue;

    const first = lines[0];
    const isSale     = lines.some((l) => l.account_code?.startsWith("4"));
    const isPurchase = lines.some((l) => l.account_code?.startsWith("5"));
    const isRetention =
      lines.some((l) =>
        l.account_code?.startsWith("201020201") ||
        l.account_code?.startsWith("201020202")
      );

    // Revenue base (credit on income accounts)
    const baseImpGrav = lines
      .filter((l) => l.account_code?.startsWith("4"))
      .reduce((s, l) => s + Number(l.credit || 0), 0);

    // Purchase base (debit on expense accounts 5xx only)
    const baseImponible = lines
      .filter((l) => l.account_code?.startsWith("5"))
      .reduce((s, l) => s + Number(l.debit || 0), 0);

    // IVA compras (debit on 133xxxx)
    const ivaCompras = lines
      .filter((l) => l.account_code?.startsWith("133"))
      .reduce((s, l) => s + Number(l.debit || 0), 0);

    // IVA ventas (credit on 20105xxxx)
    const ivaVentas = lines
      .filter((l) => l.account_code?.startsWith("20105"))
      .reduce((s, l) => s + Number(l.credit || 0), 0);

    const ruc          = first.issuerRUC || first.supplier_ruc || (first as any).customerRUC || "";
    const razonSocial  = first.issuerName || first.supplier_name || (first as any).customerName || "";
    const invoiceNum   = first.invoice_number || "";
    const authorization = first.tax?.document?.authorization || "";

    // ── VENTAS ───────────────────────────────────────────────────────────────
    if (isSale && baseImpGrav > 0) {
      ventas.push({
        period,
        type: "venta",
        date: first.date,
        ruc,
        razonSocial,
        documentType: "18",
        sequential: invoiceNum,
        baseNoGraIva: 0,
        baseImponible: 0,
        baseImpGrav,
        montoIva: ivaVentas,
      });
    }

    // ── COMPRAS ──────────────────────────────────────────────────────────────
    if (isPurchase && baseImponible > 0) {
      compras.push({
        period,
        type: "compra",
        date: first.date,
        ruc,
        razonSocial,
        documentType: "01",
        sequential: invoiceNum,
        baseNoGraIva: 0,
        baseImponible,
        baseImpGrav: 0,
        montoIva: ivaCompras,
      });
    }

    // ── RETENCIONES ──────────────────────────────────────────────────────────
    if (isRetention) {
      const retAmount = lines
        .filter(
          (l) =>
            l.account_code?.startsWith("201020201") ||
            l.account_code?.startsWith("201020202")
        )
        .reduce((s, l) => s + Number(l.credit || 0), 0);

      if (retAmount > 0) {
        retenciones.push({
          period,
          type: "retencion",
          date: first.date,
          ruc,
          razonSocial,
          documentType: "07",
          sequential: invoiceNum,
          baseNoGraIva: 0,
          baseImponible: baseImponible || baseImpGrav,
          baseImpGrav: 0,
          montoIva: retAmount,
        });
      }
    }
  }

  return { compras, ventas, retenciones, anulados };
}
