// src/services/effectiveAccountsService.ts

import type { Account } from "@/types/AccountTypes";
import { fetchEntityAccounts } from "@/services/entityAccountsService";
import { initializeEntityCOA } from "@/services/coaService";
import ECUADOR_COA from "@/../shared/coa/ecuador_coa";

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

  let firestoreAccounts = await fetchEntityAccounts(entityId);

  // Self-healing: initialize if the entity has no accounts at all
  if (!firestoreAccounts.length) {
    await initializeEntityCOA(entityId);
    firestoreAccounts = await fetchEntityAccounts(entityId);
  }

  // Merge: Firestore accounts win on code conflict; ECUADOR_COA fills the gaps.
  // This ensures newly added COA accounts are always searchable even before
  // a manual syncEntityCOA() is run on existing entities.
  const firestoreCodes = new Set(firestoreAccounts.map((a) => a.code));
  const coaFallbacks = ECUADOR_COA.filter((a) => !firestoreCodes.has(a.code));
  const effectiveAccounts = [...firestoreAccounts, ...coaFallbacks];

  const { postableAccounts, postableCodeSet } =
    computePostables(effectiveAccounts);

  return {
    effectiveAccounts,
    postableAccounts,
    postableCodeSet,
  };
}