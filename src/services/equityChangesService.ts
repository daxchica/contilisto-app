// ============================================================================
// src/services/equityChangesService.ts
// CONTILISTO — Estado de Cambios en el Patrimonio
// Superintendencia de Compañías del Ecuador format
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";

/* =============================================================================
   TYPES
============================================================================= */

/** A single column in the equity statement (one per equity group) */
export interface EquityColumn {
  code: string;    // account code prefix, e.g. "301"
  label: string;   // human-readable label
  short: string;   // short label for narrow columns
}

/** One row (a period or an event) in the equity statement */
export interface EquityRow {
  label: string;
  /** Balance per column code — may be 0 if nothing happened */
  values: Record<string, number>;
  total: number;
  /** "balance" rows are bold/highlighted; "movement" rows are regular */
  rowType: "balance" | "movement";
}

export interface EquityStatement {
  year: number;
  columns: EquityColumn[];
  rows: EquityRow[];
}

/* =============================================================================
   EQUITY COLUMNS (Supercias standard)
============================================================================= */

export const EQUITY_COLUMNS: EquityColumn[] = [
  { code: "30101", label: "Capital Suscrito",          short: "Capital" },
  { code: "30102", label: "Capital Pagado",             short: "Cap. Pagado" },
  { code: "302",   label: "Aportes Futura Capital.",   short: "Aportes" },
  { code: "30301", label: "Reserva Legal",              short: "Res. Legal" },
  { code: "30302", label: "Reservas Estatutarias",      short: "Res. Est." },
  { code: "30303", label: "Reservas Facultativas",      short: "Res. Fac." },
  { code: "304",   label: "Superávit",                  short: "Superávit" },
  { code: "305",   label: "Resultados Acumulados",      short: "Res. Acum." },
  { code: "307",   label: "Resultado del Ejercicio",   short: "Resultado" },
];

/* =============================================================================
   HELPERS
============================================================================= */

function n2(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

/** Map an account code to the column it belongs to.
 *  Returns null if the account is not an equity account. */
function toColumnCode(accountCode: string): string | null {
  const code = String(accountCode ?? "").trim();
  if (!code.startsWith("3")) return null;

  // Try most-specific match first
  for (const col of EQUITY_COLUMNS) {
    if (code.startsWith(col.code)) return col.code;
  }

  // Generic equity catch-all → Resultados Acumulados bucket
  return "305";
}

/** Net credit effect for an equity (credit-normal) account from a journal line */
function netCredit(entry: JournalEntry): number {
  return n2(Number(entry.credit ?? 0) - Number(entry.debit ?? 0));
}

/** Compute the column-keyed balance map from a set of journal entries */
function computeBalances(entries: JournalEntry[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const col of EQUITY_COLUMNS) result[col.code] = 0;

  for (const e of entries) {
    const colCode = toColumnCode(e.account_code ?? "");
    if (!colCode) continue;
    result[colCode] = n2((result[colCode] ?? 0) + netCredit(e));
  }

  return result;
}

function rowTotal(values: Record<string, number>): number {
  return n2(Object.values(values).reduce((s, v) => s + v, 0));
}

function buildBalanceRow(label: string, values: Record<string, number>): EquityRow {
  return { label, values: { ...values }, total: rowTotal(values), rowType: "balance" };
}

function buildMovementRow(label: string, values: Record<string, number>): EquityRow {
  // Only emit a movement row when there is at least one non-zero value
  const total = rowTotal(values);
  return { label, values: { ...values }, total, rowType: "movement" };
}

/** Add two balance maps */
function addMaps(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of allKeys) {
    result[k] = n2((a[k] ?? 0) + (b[k] ?? 0));
  }
  return result;
}

/* =============================================================================
   MOVEMENT CATEGORIZATION
   Detect special equity transactions so they can be shown as named rows.
============================================================================= */

interface MovementGroup {
  label: string;
  /** Entries that belong to this group */
  entries: JournalEntry[];
  /** Derived balance per column */
  values: Record<string, number>;
}

function categorizeMovements(yearEntries: JournalEntry[]): MovementGroup[] {
  // Group all transactions (by transactionId) and inspect the account mix
  const txMap = new Map<string, JournalEntry[]>();
  for (const e of yearEntries) {
    const tx = e.transactionId || e.transaction_id || `${e.date}-${e.account_code}`;
    if (!txMap.has(tx)) txMap.set(tx, []);
    txMap.get(tx)!.push(e);
  }

  // Buckets
  const buckets: Record<string, JournalEntry[]> = {
    resultado:   [],  // P&L close-out → transfers from 4xx/5xx into 307
    dividendos:  [],  // entries touching 308 (dividends)
    reservas:    [],  // entries moving between 305 and 303
    capital:     [],  // entries touching 301 or 302
    otros:       [],  // catch-all
  };

  for (const [, lines] of txMap) {
    const codes = lines.map((l) => (l.account_code ?? "").trim());
    const touches = (prefix: string) => codes.some((c) => c.startsWith(prefix));

    if (touches("308")) {
      buckets.dividendos.push(...lines);
    } else if (touches("307") || (touches("4") && touches("3"))) {
      buckets.resultado.push(...lines);
    } else if (touches("303") || touches("305")) {
      buckets.reservas.push(...lines);
    } else if (touches("301") || touches("302")) {
      buckets.capital.push(...lines);
    } else if (codes.some((c) => c.startsWith("3"))) {
      buckets.otros.push(...lines);
    }
    // Entries with no equity account at all are irrelevant
  }

  const groups: MovementGroup[] = [];

  const push = (label: string, key: string) => {
    if (!buckets[key].length) return;
    const values = computeBalances(buckets[key]);
    const total = rowTotal(values);
    if (total !== 0 || Object.values(values).some((v) => v !== 0)) {
      groups.push({ label, entries: buckets[key], values });
    }
  };

  push("Utilidad (Pérdida) del ejercicio", "resultado");
  push("Distribución de dividendos",       "dividendos");
  push("Transferencia a reservas",         "reservas");
  push("Aumento de capital",               "capital");
  push("Otros cambios en el patrimonio",   "otros");

  return groups;
}

/* =============================================================================
   MAIN FUNCTION
============================================================================= */

export function computeEquityStatement(
  allEntries: JournalEntry[],
  entityId: string,
  year: number
): EquityStatement {
  const startOfYear = `${year}-01-01`;
  const endOfYear   = `${year}-12-31`;

  const entityEntries = allEntries.filter(
    (e) => e && e.entityId === entityId
  );

  // ── Opening balance: initial entries + everything strictly before the year ──
  const openingEntries = entityEntries.filter((e) => {
    if (e.source === "initial") return true;
    const d = String(e.date ?? "");
    return d < startOfYear;
  });

  // ── Period entries: non-initial within the year ──
  const yearEntries = entityEntries.filter((e) => {
    if (e.source === "initial") return false;
    const d = String(e.date ?? "");
    return d >= startOfYear && d <= endOfYear;
  });

  // Seed result map with all column keys
  const zero: Record<string, number> = {};
  for (const col of EQUITY_COLUMNS) zero[col.code] = 0;

  const openingValues = { ...zero, ...computeBalances(openingEntries) };
  const movementGroups = categorizeMovements(yearEntries);

  // ── Build rows ────────────────────────────────────────────────────────────
  const rows: EquityRow[] = [];

  // Opening balance row
  rows.push(buildBalanceRow(`Saldo al 31 de diciembre de ${year - 1}`, openingValues));

  // Movement rows (only non-zero ones)
  for (const g of movementGroups) {
    const filled = { ...zero, ...g.values };
    const row = buildMovementRow(g.label, filled);
    if (row.total !== 0 || Object.values(row.values).some((v) => v !== 0)) {
      rows.push(row);
    }
  }

  // Any equity movements not already categorized (fall-through)
  const categorizedEntries = new Set(
    movementGroups.flatMap((g) => g.entries.map((e) => e.id))
  );
  const uncategorized = yearEntries.filter(
    (e) => e.account_code?.startsWith("3") && !categorizedEntries.has(e.id)
  );
  if (uncategorized.length > 0) {
    const values = { ...zero, ...computeBalances(uncategorized) };
    const row = buildMovementRow("Otros movimientos del patrimonio", values);
    if (row.total !== 0) rows.push(row);
  }

  // Closing balance row = opening + all year movements
  const yearValues = { ...zero, ...computeBalances(yearEntries) };
  const closingValues = addMaps(openingValues, yearValues);
  rows.push(buildBalanceRow(`Saldo al 31 de diciembre de ${year}`, closingValues));

  return { year, columns: EQUITY_COLUMNS, rows };
}
