export type CashflowCategory =
  | "operating"
  | "investing"
  | "financing"
  | "uncategorized";

export type CashflowDirection = "in" | "out";

export type UnifiedEventType = "opening" | "real" | "forecast";

export interface UnifiedCashflowEvent {
  id: string;
  date: string; // YYYY-MM-DD
  type: UnifiedEventType;

  amount: number; // signed (+ inflow, - outflow)
  direction: CashflowDirection;

  description: string;
  category: CashflowCategory;

  // optional metadata
  bankAccountId?: string;
  reference?: string;

  invoiceId?: string;
  invoiceNumber?: string;
  partyName?: string;
  partyRUC?: string;

  // computed
  runningBalance?: number;
}

export interface UnifiedCashflowTotals {
  inflow: number;     // positive sums
  outflow: number;    // absolute sums
  net: number;        // inflow - outflow (signed sum)
  byCategory: Record<CashflowCategory, number>;
}

export interface UnifiedCashflowResult {
  openingBalance: number;
  openingDate: string; // YYYY-MM-DD

  events: UnifiedCashflowEvent[]; // merged chronological
  totals: UnifiedCashflowTotals;

  projectedClosingBalance: number; // last running balance
}