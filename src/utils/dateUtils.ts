/**
 * Adds N days to an ISO date (YYYY-MM-DD)
 */
export function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the last calendar day of a given month as YYYY-MM-DD.
 * month is 1-based (1 = January, 12 = December).
 * Uses "day 0 of the next month" trick — handles leap years automatically.
 */
export function getLastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0); // month is 1-based; day 0 = last day of prev month
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Given a YYYY-MM-DD string, returns { year, month } (month 1-based).
 */
export function parseYearMonth(iso: string): { year: number; month: number } {
  const [y, m] = iso.split("-").map(Number);
  return { year: y, month: m };
}

/**
 * Default Initial Balance Date.
 * Accounting rule: December 31st of the previous fiscal year.
 */
export function getDefaultInitialBalanceDate(
  now: Date = new Date()
): string {
  return getLastDayOfMonth(now.getFullYear() - 1, 12);
}

export function normalizeISODate(dateISO?: string): string | null {
  if (!dateISO) return null;
  return dateISO.slice(0, 10); // YYYY-MM-DD
}