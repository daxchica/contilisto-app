// src/services/sri/iva104Service.ts

import type { JournalEntry } from "@/types/JournalEntry";
import type { IvaDeclarationSummary } from "@/types/sri";

type BuildIvaParams = {
  entries: JournalEntry[];
  entityId?: string;
  period: string; // YYYY-MM
  accountMap?: {
    ventas12?: string[];
    ventas0?: string[];
    ivaVentas?: string[];
    compras12?: string[];
    compras0?: string[];
    ivaCompras?: string[];
    retIvaRecibidas?: string[];
    saldoCreditoAnterior?: string[];
  };
};

const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

const samePeriod = (dateLike: string | undefined, period: string) => {
  if (!dateLike) return false;
  return String(dateLike).slice(0, 7) === period;
};

const sumByCodes = (
  entries: JournalEntry[],
  codes: string[] | undefined,
  side: "debit" | "credit"
) => {
  if (!codes?.length) return 0;

  const set = new Set(codes);
  return entries.reduce((acc, e) => {
    const code = String(e.account_code ?? "").trim();
    if (!set.has(code)) return acc;
    return acc + n(e[side]);
  }, 0);
};

export function buildIva104Summary({
  entries,
  entityId,
  period,
  accountMap,
}: BuildIvaParams): IvaDeclarationSummary {
  const periodEntries = entries.filter((e) => {
    if (entityId && e.entityId !== entityId) return false;
    if (e.source === "initial") return false;
    return samePeriod(e.date, period);
  });

  // These should later be aligned to your Ecuador COA map.
  const ventas12 = sumByCodes(periodEntries, accountMap?.ventas12, "credit");
  const ventas0 = sumByCodes(periodEntries, accountMap?.ventas0, "credit");
  const ivaVentas = sumByCodes(periodEntries, accountMap?.ivaVentas, "credit");

  const compras12 = sumByCodes(periodEntries, accountMap?.compras12, "debit");
  const compras0 = sumByCodes(periodEntries, accountMap?.compras0, "debit");
  const ivaCompras = sumByCodes(periodEntries, accountMap?.ivaCompras, "debit");

  const retIvaRecibidas = sumByCodes(
    periodEntries,
    accountMap?.retIvaRecibidas,
    "debit"
  );

  // For now, this can come from prior period carry-forward logic.
  const saldoCreditoAnterior = 0;

  const totalCredito =
    ivaCompras + retIvaRecibidas + saldoCreditoAnterior;

  const neto = ivaVentas - totalCredito;

  const ivaPagar = neto > 0 ? neto : 0;
  const saldoArrastrar = neto < 0 ? Math.abs(neto) : 0;

  const warnings: string[] = [];

  if (ivaVentas < 0 || ivaCompras < 0) {
    warnings.push("Se detectaron valores negativos de IVA; revisar notas de crédito o mapeo contable.");
  }

  if (!accountMap?.ivaVentas?.length || !accountMap?.ivaCompras?.length) {
    warnings.push("Falta configurar el mapeo contable de IVA ventas / IVA compras.");
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