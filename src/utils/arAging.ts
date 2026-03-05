// ============================================================================
// AR Aging Algorithm — ERP Style
// src/utils/arAging.ts
// ============================================================================

import type { Receivable } from "@/types/Receivable";

export interface AgingRow {
  customerName: string;

  current: number;
  d30: number;
  d60: number;
  d90: number;
  d120: number;

  total: number;
}

const n2 = (x: number) => Number(x.toFixed(2));

function daysBetween(date1: string, date2: Date) {
  const d1 = new Date(date1);
  const diff = date2.getTime() - d1.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function buildARAging(receivables: Receivable[]): AgingRow[] {
  const today = new Date();

  const map: Record<string, AgingRow> = {};

  for (const r of receivables) {
    if (!r.balance || r.balance <= 0) continue;
    if (r.status === "paid") continue;

    const customer = r.customerName || "Cliente";

    if (!map[customer]) {
      map[customer] = {
        customerName: customer,
        current: 0,
        d30: 0,
        d60: 0,
        d90: 0,
        d120: 0,
        total: 0,
      };
    }

    const days = daysBetween(r.issueDate, today);
    const balance = n2(r.balance);

    if (days <= 30) {
      map[customer].current += balance;
    } else if (days <= 60) {
      map[customer].d30 += balance;
    } else if (days <= 90) {
      map[customer].d60 += balance;
    } else if (days <= 120) {
      map[customer].d90 += balance;
    } else {
      map[customer].d120 += balance;
    }

    map[customer].total += balance;
  }

  return Object.values(map).map((r) => ({
    ...r,
    current: n2(r.current),
    d30: n2(r.d30),
    d60: n2(r.d60),
    d90: n2(r.d90),
    d120: n2(r.d120),
    total: n2(r.total),
  }));
}