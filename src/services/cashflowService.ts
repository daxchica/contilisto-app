// ============================================================================
// src/services/cashflowService.ts
// ---------------------------------------------------------------------------
// Cash Flow Service — CONTILISTO v1.0
//
// SOURCE OF TRUTH: Bank Movements (Libro Bancos)
//
// USER-FACING (Spanish):
// - Flujo de efectivo real basado en ingresos y egresos bancarios.
// ============================================================================

import type { BankMovement } from "./bankMovementService";
import { fetchBankMovements } from "./bankMovementService";

export type CashflowCategory =
  | "operating"
  | "investing"
  | "financing"
  | "uncategorized";

export interface CashflowEvent {
  id: string;
  date: string;
  amount: number;
  category: CashflowCategory;
  description: string;
  bankAccountId: string;
  reference?: string;
}

export interface CashflowTotals {
  operating: number;
  investing: number;
  financing: number;
  uncategorized: number;
  net: number;
}

export interface CashflowResult {
  events: CashflowEvent[];
  totals: CashflowTotals;
}

/* ---------------------------------------------------------------------------
 * Category resolver (simple v1)
 * ---------------------------------------------------------------------------
 * TODO (v2):
 * - Classify by linked journal transaction
 * - Classify by counter-account
 * ---------------------------------------------------------------------------
 */
function resolveCategory(
  movement: BankMovement
): CashflowCategory {
  if (movement.relatedJournalTransactionId) {
    return "operating"; // default safe assumption
  }
  return "uncategorized";
}

/* ---------------------------------------------------------------------------
 * Fetch Cash Flow from Bank Movements
 * ---------------------------------------------------------------------------
 */
export async function fetchCashflow(
  entityId: string,
  from?: string,
  to?: string
): Promise<CashflowResult> {
  const movements = await fetchBankMovements(entityId, from, to);

  const events: CashflowEvent[] = movements.map((m) => ({
    id: m.id!,
    date: m.date,
    amount: m.amount,
    category: resolveCategory(m),
    description: m.description,
    bankAccountId: m.bankAccountId,
    reference: m.reference,
  }));

  const totals: CashflowTotals = {
    operating: 0,
    investing: 0,
    financing: 0,
    uncategorized: 0,
    net: 0,
  };

  for (const e of events) {
    totals[e.category] += e.amount;
    totals.net += e.amount;
  }

  return { events, totals };
}