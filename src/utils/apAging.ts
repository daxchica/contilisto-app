// ============================================================================
// AP Aging Algorithm — mirrors arAging.ts
// src/utils/apAging.ts
// ============================================================================

import type { Payable } from "@/types/Payable";

export interface APAgingRow {
  supplierName: string;

  current: number; // 0 – 30 days
  d30: number;     // 31 – 60 days
  d60: number;     // 61 – 90 days
  d90: number;     // 91 – 120 days
  d120: number;    // > 120 days

  total: number;
}

const n2 = (x: number) => Number(x.toFixed(2));

function daysPastDue(dateStr: string | undefined, today: Date): number {
  if (!dateStr) return 0;
  const due = new Date(dateStr);
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function addToBucket(row: APAgingRow, days: number, amount: number) {
  if (days <= 30) {
    row.current += amount;
  } else if (days <= 60) {
    row.d30 += amount;
  } else if (days <= 90) {
    row.d60 += amount;
  } else if (days <= 120) {
    row.d90 += amount;
  } else {
    row.d120 += amount;
  }
  row.total += amount;
}

export function buildAPAging(payables: Payable[]): APAgingRow[] {
  const today = new Date();
  const map: Record<string, APAgingRow> = {};

  for (const p of payables) {
    if (p.status === "paid") continue;
    if (!p.balance || p.balance <= 0) continue;

    const supplier = p.supplierName || p.supplierRUC || "Proveedor";

    if (!map[supplier]) {
      map[supplier] = {
        supplierName: supplier,
        current: 0,
        d30: 0,
        d60: 0,
        d90: 0,
        d120: 0,
        total: 0,
      };
    }

    const row = map[supplier];

    // With installments: age each unpaid installment by its own dueDate
    if (p.installmentSchedule?.length) {
      for (const inst of p.installmentSchedule) {
        if (inst.balance <= 0) continue;
        const days = Math.max(0, daysPastDue(inst.dueDate, today));
        addToBucket(row, days, n2(inst.balance));
      }
    } else {
      // Single due date: fall back to issueDate if dueDate missing
      const refDate = p.dueDate || p.issueDate;
      const days = Math.max(0, daysPastDue(refDate, today));
      addToBucket(row, days, n2(p.balance));
    }
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
