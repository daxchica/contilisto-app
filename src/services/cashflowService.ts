// ============================================================================
// src/services/cashFlowService.ts
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

/* ============================================================================
 * TYPES
 * ========================================================================== */

export type CashflowCategory =
  | "operating"
  | "investing"
  | "financing"
  | "uncategorized";

export type CashflowDirection = "in" | "out";

export interface CashflowEvent {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // signed
  direction: CashflowDirection;
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
  inflow: number;
  outflow: number;
}

export interface CashflowResult {
  events: CashflowEvent[];
  totals: CashflowTotals;
}

/* ============================================================================
 * INTERNAL HELPERS
 * ========================================================================== */

function resolveCategory(m: BankMovement): CashflowCategory {
  if (m.relatedJournalTransactionId) {
    return "operating";
  }
  return "uncategorized";
}

function resolveDirection(amount: number): CashflowDirection {
  return amount >= 0 ? "in" : "out";
}

/**
 * Normalize to YYYY-MM-DD for Firestore string queries
 */
function normalizeDate(input?: string | number): string | undefined {
  if (input === undefined || input === null || input === "") return undefined;

  if (typeof input === "number") {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function safeId(m: BankMovement, idx: number): string {
  return m.id ?? `${m.date ?? "no-date"}_${idx}`;
}

/* ============================================================================
 * PUBLIC API
 * ========================================================================== */

/**
 * REAL cash flow (Libro Bancos)
 */
export async function getRealCashFlow(
  entityId: string,
  from?: string | number,
  to?: string | number
): Promise<CashflowResult> {
  const fromDate = normalizeDate(from);
  const toDate = normalizeDate(to);

  const movements = await fetchBankMovements(
    entityId,
    fromDate,
    toDate
  );

  const events: CashflowEvent[] = movements.map((m, idx) => {
    const amount = Number(m.amount) || 0;

    return {
      id: safeId(m, idx),
      date: m.date,
      amount,
      direction: resolveDirection(amount),
      category: resolveCategory(m),
      description: m.description ?? "Movimiento bancario",
      bankAccountId: m.bankAccountId,
      reference: m.reference,
    };
  });

  // Ensure deterministic order (Firestore already sorts, but UI safety)
  events.sort((a, b) => a.date.localeCompare(b.date));

  const totals: CashflowTotals = {
    operating: 0,
    investing: 0,
    financing: 0,
    uncategorized: 0,
    net: 0,
    inflow: 0,
    outflow: 0,
  };

  for (const e of events) {
    totals[e.category] += e.amount;
    totals.net += e.amount;

    if (e.direction === "in") totals.inflow += e.amount;
    else totals.outflow += Math.abs(e.amount);
  }

  return { events, totals };
}