// ============================================================================
// src/services/sri/iva104Service.ts
// CONTILISTO — IVA 104 ENGINE (Production Hardened / Transaction-based)
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";
import type { IvaDeclarationSummary } from "@/types/sri";
import type { TaxLedgerEntry } from "@/types/TaxLedgerEntry";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type AccountMap = {
  ventas12: string[];
  ventas0: string[];
  ivaVentas: string[];
  compras12: string[];
  compras0: string[];
  ivaCompras: string[];
  retIvaRecibidas?: string[];
  saldoCreditoAnterior?: string[];
};

type BuildIvaParams = {
  entries: JournalEntry[];
  entityId?: string;
  period: string; // YYYY-MM
  accountMap: AccountMap;
};

type FirestoreTimestamp = {
  toDate: () => Date;
};

type NormalizedEntry = JournalEntry & {
  _code: string;
  _debit: number;
  _credit: number;
  _documentNature: "sale" | "purchase";
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const normalizeCode = (code: unknown): string =>
  String(code ?? "")
    .trim()
    .replace(/\./g, "")
    .replace(/\s+/g, "");

const toNumber = (v?: number): number =>
  Number.isFinite(Number(v)) ? Number(v) : 0;

const round2 = (n: number): number => Math.round(n * 100) / 100;

const samePeriod = (date: unknown, period: string): boolean => {
  if (!date) return false;

  if (
    typeof date === "object" &&
    date !== null &&
    "toDate" in date &&
    typeof (date as FirestoreTimestamp).toDate === "function"
  ) {
    const d = (date as FirestoreTimestamp).toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}` === period;
  }

  if (typeof date === "string") {
    return date.slice(0, 7) === period;
  }

  return false;
};

const validatePeriod = (period: string): void => {
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error(`Invalid IVA period format: ${period}`);
  }
};

function startsWithAny(code: string, prefixes: string[]): boolean {
  if (!code || !prefixes.length) return false;
  return prefixes.some((p) => code.startsWith(normalizeCode(p)));
}

function inferTaxableBaseFromIva(iva: number): number {
  if (iva <= 0) return 0;
  return round2(iva / 0.12);
}

function resolveDocumentNature(e: JournalEntry): "sale" | "purchase" {
  if (e.documentNature === "sale" || e.documentNature === "purchase") {
    return e.documentNature;
  }

  const code = normalizeCode(e.account_code);

  if (
    code.startsWith("2") ||
    code.startsWith("5") ||
    code.startsWith("6") ||
    code.startsWith("133") ||
    code.startsWith("20103")
  ) {
    return "purchase";
  }

  return "sale";
}

function normalizeEntry(e: JournalEntry): NormalizedEntry {
  return {
    ...e,
    _code: normalizeCode(e.account_code),
    _debit: round2(toNumber(e.debit)),
    _credit: round2(toNumber(e.credit)),
    _documentNature: resolveDocumentNature(e),
  };
}

function shouldIgnoreEntry(
  e: JournalEntry,
  entityId: string | undefined,
  period: string
): boolean {
  if (!e) return true;
  if (entityId && e.entityId !== entityId) return true;
  if (e.source === "initial") return true;
  if (!samePeriod(e.date, period)) return true;
  if (e.transactionType === "transfer") {
    return false;
  }
  return false;
}

function buildTransactionGroups(entries: JournalEntry[]): Map<string, JournalEntry[]> {
  const grouped = new Map<string, JournalEntry[]>();

  for (const e of entries) {
    const tx = String(e.transactionId ?? "").trim();
    if (!tx) continue;

    if (!grouped.has(tx)) {
      grouped.set(tx, []);
    }

    grouped.get(tx)!.push(e);
  }

  return grouped;
}

/* -------------------------------------------------------------------------- */
/* MAIN ENGINE                                                                */
/* -------------------------------------------------------------------------- */

export function buildIva104Summary({
  entries,
  entityId,
  period,
  accountMap,
}: BuildIvaParams): IvaDeclarationSummary {
  validatePeriod(period);

  let ventas12 = 0;
  let ventas0 = 0;
  let ivaVentas = 0;

  let compras12 = 0;
  let compras0 = 0;
  let ivaCompras = 0;

  let retIvaRecibidas = 0;

  const filtered = entries.filter((e) => !shouldIgnoreEntry(e, entityId, period));
  const grouped = buildTransactionGroups(filtered);

  for (const [, group] of grouped) {
    const normalized = group.map(normalizeEntry);

    /* ------------------------------- SALES ------------------------------ */
    const saleLines = normalized.filter((e) => e._documentNature === "sale");

    for (const e of saleLines) {
      if (startsWithAny(e._code, accountMap.ventas12)) {
        ventas12 += e._credit;
      }

      if (startsWithAny(e._code, accountMap.ventas0)) {
        ventas0 += e._credit;
      }

      if (startsWithAny(e._code, accountMap.ivaVentas)) {
        ivaVentas += e._credit;
      }
    }

    /* ------------------------------ PURCHASES --------------------------- */
    const purchaseLines = normalized.filter((e) => e._documentNature === "purchase");

    const ivaPurchaseLines = purchaseLines.filter((e) =>
      startsWithAny(e._code, accountMap.ivaCompras)
    );

    const expenseLines = purchaseLines.filter(
      (e) =>
        startsWithAny(e._code, accountMap.compras12) &&
        !startsWithAny(e._code, accountMap.ivaCompras) &&
        !(accountMap.retIvaRecibidas && startsWithAny(e._code, accountMap.retIvaRecibidas))
    );

    const compras0Lines = purchaseLines.filter(
      (e) =>
        startsWithAny(e._code, accountMap.compras0) &&
        !startsWithAny(e._code, accountMap.ivaCompras) &&
        !(accountMap.retIvaRecibidas && startsWithAny(e._code, accountMap.retIvaRecibidas))
    );

    const ivaCompraTx = round2(
      ivaPurchaseLines.reduce((sum, e) => sum + e._debit, 0)
    );

    const expenseBaseTx = round2(
      expenseLines.reduce((sum, e) => sum + e._debit, 0)
    );

    const compras0Tx = round2(
      compras0Lines.reduce((sum, e) => sum + e._debit, 0)
    );

    if (ivaCompraTx > 0) {
      ivaCompras += ivaCompraTx;

      // If the transaction has IVA purchase lines, it is treated as taxable purchase.
      // To avoid overstating the tax base:
      // - if explicit expense base exists, use the smaller between explicit base
      //   and base inferred from IVA
      // - otherwise infer base from IVA
      const inferredBase = inferTaxableBaseFromIva(ivaCompraTx);

      const taxableBaseTx =
        expenseBaseTx > 0
          ? Math.min(expenseBaseTx, inferredBase)
          : inferredBase;

      compras12 += round2(taxableBaseTx);

      // Optional conservative behavior:
      // if the same transaction also has 0% expense lines, keep them as compras0
      if (compras0Tx > 0) {
        compras0 += compras0Tx;
      }
    } else {
      // No IVA in transaction: only 0% purchases should be accumulated here
      compras0 += compras0Tx;
    }

    /* ----------------------------- RETENTIONS --------------------------- */
    for (const e of purchaseLines) {
      if (
        accountMap.retIvaRecibidas &&
        startsWithAny(e._code, accountMap.retIvaRecibidas)
      ) {
        retIvaRecibidas += e._debit;
      }
    }
  }

  ventas12 = round2(ventas12);
  ventas0 = round2(ventas0);
  ivaVentas = round2(ivaVentas);

  compras12 = round2(compras12);
  compras0 = round2(compras0);
  ivaCompras = round2(ivaCompras);

  retIvaRecibidas = round2(retIvaRecibidas);

  const saldoCreditoAnterior = 0;

  const totalCredito = round2(
    ivaCompras + retIvaRecibidas + saldoCreditoAnterior
  );

  const neto = round2(ivaVentas - totalCredito);

  const ivaPagar = neto > 0 ? neto : 0;
  const saldoArrastrar = neto < 0 ? Math.abs(neto) : 0;

  const warnings: string[] = [];

  if (ivaVentas < 0 || ivaCompras < 0) {
    warnings.push(
      "Valores negativos detectados en IVA. Verificar notas de crédito."
    );
  }

  if (ventas12 === 0 && ivaVentas > 0) {
    warnings.push(
      "IVA ventas detectado sin ventas gravadas. Revisar mapeo contable."
    );
  }

  if (compras12 === 0 && ivaCompras > 0) {
    warnings.push(
      "IVA compras detectado sin base gravada explícita. Se usó base inferida desde el IVA."
    );
  }

  return {
    period,
    ventas12,
    ventas0,
    ivaVentas,
    compras12,
    compras0,
    ivaCompras,
    retIvaRecibidas,
    saldoCreditoAnterior,
    totalCredito,
    ivaPagar,
    saldoArrastrar,
    warnings,
  };
}

export function buildIva104SummaryFromLedger(
  ledger: TaxLedgerEntry[],
  period: string
): IvaDeclarationSummary {

  let ventas12 = 0;
  let ventas0 = 0;
  let ivaVentas = 0;

  let compras12 = 0;
  let compras0 = 0;
  let ivaCompras = 0;

  let retIvaRecibidas = 0;

  for (const l of ledger) {

    if (!l) continue;
    if (l.period !== period) continue;

    if (l.type === "sale") {
      ventas12 += l.base12 || 0;
      ventas0 += l.base0 || 0;
      ivaVentas += l.iva || 0;
    }

    if (l.type === "purchase") {
      compras12 += l.base12 || 0;
      compras0 += l.base0 || 0;
      ivaCompras += l.iva || 0;
      retIvaRecibidas += l.retentionIva || 0;
    }
  }

  const totalCredito = ivaCompras + retIvaRecibidas;
  const neto = ivaVentas - totalCredito;

  return {
    period,
    ventas12,
    ventas0,
    ivaVentas,
    compras12,
    compras0,
    ivaCompras,
    retIvaRecibidas,
    saldoCreditoAnterior: 0,
    totalCredito,
    ivaPagar: neto > 0 ? neto : 0,
    saldoArrastrar: neto < 0 ? Math.abs(neto) : 0,
    warnings: [],
  };
}