// src/services/effectiveAccountsService.ts

import type { Account } from "@/types/AccountTypes";
import { fetchEntityAccounts } from "@/services/entityAccountsService";
import { initializeEntityCOA } from "@/services/coaService";

/* ============================================================================
   TYPES
============================================================================ */

export type EffectiveAccountPlan = {
  effectiveAccounts: Account[];
  postableAccounts: Account[];
  postableCodeSet: Set<string>;
};

/* ============================================================================
   POSTABLE RESOLUTION
============================================================================ */

function computePostables(accounts: Account[]) {
  const codes = accounts.map(a => a.code);

  const postableAccounts = accounts.filter(current =>
    !codes.some(other =>
      other !== current.code &&
      other.startsWith(current.code)
    )
  );

  return {
    postableAccounts,
    postableCodeSet: new Set(postableAccounts.map(a => a.code)),
  };
}

/* ============================================================================
   MAIN SERVICE
============================================================================ */

export async function getEffectiveAccountPlan(
  entityId: string
): Promise<EffectiveAccountPlan> {

  if (!entityId) {
    throw new Error("EntityId is required to load account plan.");
  }

  let effectiveAccounts = await fetchEntityAccounts(entityId);

  // 🔥 Self-healing safeguard
  if (!effectiveAccounts.length) {
    await initializeEntityCOA(entityId);
    effectiveAccounts = await fetchEntityAccounts(entityId);
  }

  const { postableAccounts, postableCodeSet } =
    computePostables(effectiveAccounts);

  return {
    effectiveAccounts,
    postableAccounts,
    postableCodeSet,
  };
}