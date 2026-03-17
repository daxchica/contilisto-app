// ============================================================================
// src/types/AccountBalance.ts
// Period balance accelerator — CONTILISTO
// ============================================================================

export interface AccountBalance {

  id?: string;

  entityId: string;

  account_code: string;

  // YYYY-MM period
  period: string;

  // opening balance at start of period
  openingBalance: number;

  // totals inside the period
  periodDebit: number;
  periodCredit: number;

  // closing balance
  closingBalance: number;

  updatedAt?: number;
}