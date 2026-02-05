// ============================================================================
// src/utils/buildDailyCashFlowSeries.ts
// CONTILISTO — Build unified daily series: REAL (bank) vs PROJECTED (AR/AP)
// Window: last N days (daily buckets)
// ============================================================================

import type { CashFlowItem } from "@/types/CashFlow";
import type { CashflowEvent } from "@/services/cashFlowService";

export type CashFlowDay = {
  date: string; // YYYY-MM-DD

  realIn: number;
  realOut: number;
  realNet: number;

  projectedIn: number;
  projectedOut: number;
  projectedNet: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function clampToStartOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function parseISOToDay(iso: string): string {
  // Supports "YYYY-MM-DD" or full ISO string
  if (!iso) return "";
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Build daily cash flow series for last `days` days.
 *
 * REAL (bank movements):
 * - source: CashflowEvent[]
 * - date: YYYY-MM-DD
 * - amount >= 0 => inflow
 * - amount < 0  => outflow (absolute magnitude)
 *
 * PROJECTED (AR / AP installments):
 * - source: CashFlowItem[]
 * - dueDate: timestamp (ms)
 * - flowDirection: "in" | "out"
 *
 * Notes:
 * - Outflows are stored as positive magnitudes
 * - Net = inflow - outflow
 * - Days with no activity are included (continuous axis)
 */
export function buildDailyCashFlowSeries(args: {
  realEvents?: CashflowEvent[];
  projectedItems?: CashFlowItem[];
  days: number;          // e.g. 30 / 60 / 90
  endDateMs: number;     // REQUIRED: pass todayStart from caller
}): CashFlowDay[] {
  const {
    realEvents = [],
    projectedItems = [],
    days,
    endDateMs,
  } = args;

  if (days <= 0) return [];

  const endMs = clampToStartOfDay(endDateMs);
  const startMs = endMs - (days - 1) * DAY_MS;

  // Pre-create buckets (guarantees continuous X axis)
  const buckets = new Map<string, CashFlowDay>();

  for (let t = startMs; t <= endMs; t += DAY_MS) {
    const day = formatDay(t);
    buckets.set(day, {
      date: day,
      realIn: 0,
      realOut: 0,
      realNet: 0,
      projectedIn: 0,
      projectedOut: 0,
      projectedNet: 0,
    });
  }

  // ---- REAL (bank movements) ----
  for (const e of realEvents) {
    const day = parseISOToDay(e.date);
    const bucket = buckets.get(day);
    if (!bucket) continue;

    const amt = Number(e.amount ?? 0);
    if (amt >= 0) bucket.realIn += amt;
    else bucket.realOut += Math.abs(amt);
  }

  // ---- PROJECTED (AR / AP installments) ----
  for (const i of projectedItems) {
    const ts = Number(i.dueDate ?? 0);
    if (!ts) continue;

    const day = formatDay(clampToStartOfDay(ts));
    const bucket = buckets.get(day);
    if (!bucket) continue;

    const amt = Number(i.amount ?? 0);
    if (i.flowDirection === "in") bucket.projectedIn += amt;
    else bucket.projectedOut += amt;
  }

  // Compute nets + rounding
  return Array.from(buckets.values())
    .map((b) => {
      const realIn = round2(b.realIn);
      const realOut = round2(b.realOut);
      const projectedIn = round2(b.projectedIn);
      const projectedOut = round2(b.projectedOut);

      return {
        date: b.date,

        realIn,
        realOut,
        realNet: round2(realIn - realOut),

        projectedIn,
        projectedOut,
        projectedNet: round2(projectedIn - projectedOut),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}