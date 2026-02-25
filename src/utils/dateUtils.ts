/**
 * Adds N days to an ISO date (YYYY-MM-DD)
 */
export function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Default Initial Balance Date
 * Accounting rule:
 * December 31st of the previous fiscal year
 */
export function getDefaultInitialBalanceDate(
  now: Date = new Date()
): string {
  const year = now.getFullYear() - 1;
  return `${year}-12-31`;
}

export function normalizeISODate(dateISO?: string): string | null {
  if (!dateISO) return null;
  return dateISO.slice(0, 10); // YYYY-MM-DD
}