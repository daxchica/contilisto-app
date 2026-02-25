/**
 * Returns last day of previous fiscal year (YYYY-12-31)
 * Example:
 *  - Today: 2026-02-10 → 2025-12-31
 */
export function getInitialBalanceDate(today = new Date()): string {
  const year = today.getFullYear() - 1;
  return `${year}-12-31`;
}