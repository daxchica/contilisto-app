// ============================================================================
// src/services/sri/iva104Service.ts
// CONTILISTO — IVA 104 ENGINE (Production Ready)
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";
import type { IvaDeclarationSummary } from "@/types/sri";

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

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const normalizeCode = (code?: string) =>
  String(code ?? "").trim();

const toNumber = (v?: number) =>
  Number.isFinite(Number(v)) ? Number(v) : 0;

const samePeriod = (date?: string, period?: string) =>
  date?.slice(0, 7) === period;

const validatePeriod = (period: string) => {
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error(`Invalid IVA period format: ${period}`);
  }
};

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

  /* ---------------------------------------------------------------------- */
  /* SINGLE LEDGER PASS                                                     */
  /* ---------------------------------------------------------------------- */

  for (const e of entries) {

    if (!e) continue;

    if (entityId && e.entityId !== entityId) continue;
    if (e.source === "initial") continue;
    if (!samePeriod(e.date, period)) continue;

    const code = normalizeCode(e.account_code);

    const debit = toNumber(e.debit);
    const credit = toNumber(e.credit);

    if (!code) continue;

    /* ------------------------------- SALES ------------------------------ */

    if (accountMap.ventas12.includes(code)) ventas12 += credit;
    if (accountMap.ventas0.includes(code)) ventas0 += credit;
    if (accountMap.ivaVentas.includes(code)) ivaVentas += credit;

    /* ------------------------------ PURCHASES --------------------------- */

    if (accountMap.compras12.includes(code)) compras12 += debit;
    if (accountMap.compras0.includes(code)) compras0 += debit;
    if (accountMap.ivaCompras.includes(code)) ivaCompras += debit;

    /* ----------------------------- RETENTIONS --------------------------- */

    if (accountMap.retIvaRecibidas?.includes(code)) {
      retIvaRecibidas += debit;
    }

  }

  /* ---------------------------------------------------------------------- */
  /* TAX CALCULATION                                                        */
  /* ---------------------------------------------------------------------- */

  const saldoCreditoAnterior = 0;

  const totalCredito =
    ivaCompras +
    retIvaRecibidas +
    saldoCreditoAnterior;

  const neto = ivaVentas - totalCredito;

  const ivaPagar = neto > 0 ? neto : 0;
  const saldoArrastrar = neto < 0 ? Math.abs(neto) : 0;

  /* ---------------------------------------------------------------------- */
  /* VALIDATIONS                                                            */
  /* ---------------------------------------------------------------------- */

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

  /* ---------------------------------------------------------------------- */
  /* RESULT                                                                 */
  /* ---------------------------------------------------------------------- */

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