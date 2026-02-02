import { CashFlowItem } from "@/types/CashFlow";

/**
 * Groups cash flow items by YYYY-MM-DD
 */
export function groupCashFlowByDay(items: CashFlowItem[]) {
  return items.reduce<Record<string, CashFlowItem[]>>((acc, item) => {
    const day = new Date(item.dueDate).toISOString().slice(0, 10);
    acc[day] ??= [];
    acc[day].push(item);
    return acc;
  }, {});
}

/**
 * Filters cash flow items to next N days
 */
export function projectCashFlow(
  items: CashFlowItem[],
  days = 90
) {
  const now = Date.now();
  const future = now + days * 86400000;

  return items.filter(
    i => i.dueDate >= now && i.dueDate <= future
  );
}