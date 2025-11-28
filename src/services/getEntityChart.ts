// src/services/getEntityChart.ts
import ECUADOR_COA from "@/../shared/coa/ecuador_coa";
import { fetchCustomAccounts } from "./chartOfAccountsService";
import type { Account } from "../types/AccountTypes";

export async function getEntityChart(entityId: string): Promise<Account[]> {
  const custom = await fetchCustomAccounts(entityId);
  
  const mergedMap = new Map<string, string>();
  for (const a of ECUADOR_COA) mergedMap.set(a.code, a.name);
  for (const c of custom) mergedMap.set(c.code, c.name);
  
  return Array.from(mergedMap.entries())
    .map(([code, name]) => ({ 
      code, 
      name,
      level: code.length,
    }))
    .sort((a, b) => 
      a.code.localeCompare(b.code, "es", { numeric: true })
    );
}