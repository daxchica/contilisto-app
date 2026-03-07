import { getOpeningCashBalance } from "./openingCashService";
import { getRealCashFlow } from "./cashFlowRealService";
import { getCashflowForecast } from "@/services/cashFlowForecastService";
import { getRealCashBeforeDate } from "./cashFlowRealService";

import type {
  UnifiedCashflowEvent,
  UnifiedCashflowResult,
  CashflowCategory,
} from "@/types/UnifiedCashflow";

function todayYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

function ymdFrom(input: string | number): string {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const d = new Date(input);
  return d.toISOString().slice(0, 10);
}

function signedAmount(direction: "in" | "out", amount: number): number {
  const n = Number(amount) || 0;
  return direction === "in" ? Math.abs(n) : -Math.abs(n);
}

function forecastCategoryDefault(): CashflowCategory {
  // until we map AR/AP to categories based on invoice nature, keep it operating.
  return "operating";
}

export async function getUnifiedCashflow(
  entityId: string,
  from: string | number,
  to: string | number
): Promise<UnifiedCashflowResult> {
  const fromYMD = ymdFrom(from);
  const toYMD = ymdFrom(to);

  const initialCash = await getOpeningCashBalance(entityId);
  const realBefore = await getRealCashBeforeDate(entityId, fromYMD);

  const openingBalance = initialCash + realBefore;

  // Real cashflow: from->to (or from->today if you prefer “real up to now”)
  const real = await getRealCashFlow(entityId, fromYMD, toYMD);

  // Forecast: uses milliseconds range in your existing service
  const fromMs = new Date(fromYMD).getTime();
  const toMs = new Date(toYMD).getTime();

  const forecastItems = await getCashflowForecast(entityId, fromMs, toMs);

  const forecastEvents: UnifiedCashflowEvent[] = forecastItems.map((it) => {
    const date = ymdFrom(it.dueDate);
    const amount = signedAmount(it.flowDirection, it.amount);

    return {
      id: `forecast_${it.type}_${it.invoiceId}_${it.dueDate}`,
      date,
      type: "forecast",
      amount,
      direction: it.flowDirection,
      category: forecastCategoryDefault(),
      description:
        it.flowDirection === "in"
          ? `Cobro proyectado (${it.invoiceNumber ?? "sin #"}): ${it.partyName ?? "Cliente"}`
          : `Pago proyectado (${it.invoiceNumber ?? "sin #"}): ${it.partyName ?? "Proveedor"}`,
      invoiceId: it.invoiceId,
      invoiceNumber: it.invoiceNumber,
      partyName: it.partyName,
      partyRUC: it.partyRUC,
    };
  });

  const openingEvent: UnifiedCashflowEvent = {
    id: "opening",
    date: fromYMD,
    type: "opening",
    amount: 0,
    direction: "in",
    category: "uncategorized",
    description: "Saldo inicial de efectivo (Balance Inicial)",
  };

  const realEvents: UnifiedCashflowEvent[] = real.events.map((e) => ({
    id: `real_${e.id}`,
    date: e.date,
    type: "real",
    amount: e.amount,
    direction: e.direction,
    category: e.category,
    description: e.description,
    bankAccountId: e.bankAccountId,
    reference: e.reference,
  }));

  // Merge & sort
  const events: UnifiedCashflowEvent[] = [
    openingEvent,
    ...realEvents,
    ...forecastEvents,
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Running balance
  let running = openingBalance;
  for (const e of events) {
    if (e.type !== "opening") running += e.amount;
    e.runningBalance = running;
  }

  // Totals (exclude opening event)
  const byCategory: Record<CashflowCategory, number> = {
    operating: 0,
    investing: 0,
    financing: 0,
    uncategorized: 0,
  };

  let inflow = 0;
  let outflow = 0;
  let net = 0;

  for (const e of events) {
    if (e.type === "opening") continue;
    byCategory[e.category] += e.amount;
    net += e.amount;
    if (e.amount >= 0) inflow += e.amount;
    else outflow += Math.abs(e.amount);
  }

  return {
    openingBalance,
    openingDate: fromYMD,
    events,
    totals: { inflow, outflow, net, byCategory },
    projectedClosingBalance: running,
  };
}
