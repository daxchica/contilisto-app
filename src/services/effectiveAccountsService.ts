// src/services/effectiveAccountsService.ts

import ECUADOR_COA from "@/../shared/coa/ecuador_coa";
import type { Account, CustomAccount } from "@/types/AccountTypes";
import { fetchCustomAccounts } from "@/services/chartOfAccountsService";

/* ============================================================================
   NAME NORMALIZATION
============================================================================ */

function normalizeName(name: string): string {
  return (name ?? "")
    .replaceAll("ÓA", "ÍA")
    .replaceAll("P/BLICAS", "PÚBLICAS")
    .replaceAll("TESORERÓA", "TESORERÍA")
    .replaceAll("ASESORÓA", "ASESORÍA")
    .replaceAll("ENERGÓA", "ENERGÍA")
    .replace(/\s+/g, " ")
    .trim();
}

/* ============================================================================
   TYPES
============================================================================ */

export type EffectiveAccountPlan = {
  structuralTree: Account[];
  customAccounts: CustomAccount[];
  effectiveAccounts: Account[];

  // ✅ NEW truth
  postableAccounts: Account[];
  postableCodeSet: Set<string>;

  // ✅ Backward compatibility (optional, remove later)
  leafAccounts: Account[];
  leafCodeSet: Set<string>;

  structuralCodeSet: Set<string>;
};

/* ============================================================================
   INTERNAL SHAPING
============================================================================ */

function inferLevel(code: string): number {
  return Math.max(1, Math.ceil(code.length / 2));
}

function toAccountShape(x: any): Account {
  const code = String(x.code ?? x.account_code ?? x.codigo ?? "").trim();
  const name = normalizeName(
    String(x.name ?? x.account_name ?? x.nombre ?? "").trim()
  );

  if (!code || !/^\d+$/.test(code)) {
    throw new Error(`Invalid account code detected: "${code}"`);
  }

  return {
    code,
    name,
    level: Number(x.level ?? inferLevel(code)),

    nature: x.nature,
    taxType: x.taxType,
    category: x.category,

    rate: x.rate,
    percentage: x.percentage,
    isDeductible: x.isDeductible,

    sign: x.sign,
    isReceivable: Boolean(x.isReceivable ?? false),
    isPayable: Boolean(x.isPayable ?? false),
    requiresThirdParty: Boolean(x.requiresThirdParty ?? false),
    isBank: Boolean(x.isBank ?? false),

    parentCode: x.parentCode ?? x.parent ?? null,
  };
}

/* ============================================================================
   STRUCTURAL TREE (COMPUTED ONCE)
============================================================================ */

const STRUCTURAL_TREE: Account[] = ECUADOR_COA.map((a: any) => toAccountShape(a));
const STRUCTURAL_CODE_SET = new Set(STRUCTURAL_TREE.map(a => a.code));

/* ============================================================================
   POSTABLE (LEAF) RESOLUTION — STRUCTURAL TRUTH (O(n))
   Postable = no children by prefix, not by flags.
============================================================================ */

function computePostables(
  accounts: Account[]
): { postableAccounts: Account[]; postableCodeSet: Set<string> } {
  
  if (!accounts.length) {
    return { 
      postableAccounts: [], 
      postableCodeSet: new Set<string>(),
    };
  }

  const codes = accounts.map(a => a.code);

  const postableAccounts = accounts.filter(current =>
    !codes.some(other =>
      other !== current.code &&
      other.startsWith(current.code)
    )
  );

  const postableCodeSet = new Set(
    postableAccounts.map(a => a.code)
  );

  return { postableAccounts, postableCodeSet };
}

/* ============================================================================
   MAIN SERVICE
============================================================================ */

export async function getEffectiveAccountPlan(entityId: string): Promise<EffectiveAccountPlan> {
  const structuralTree = STRUCTURAL_TREE;
  const structuralCodeSet = STRUCTURAL_CODE_SET;
  
  const customRaw = await fetchCustomAccounts(entityId);
  if (import.meta.env.DEV) {
  console.log("Custom raw accounts:", customRaw);
}

  const customAccounts: CustomAccount[] = (customRaw ?? [])
    .map((c: any) => {
      const shaped = toAccountShape({
        ...c,
        code: String(c.code ?? "").trim(),
        name: normalizeName(String(c.name ?? "").trim()),
      });

      // CustomAccount requires parentCode string, but allow null in storage and normalize:
      const parentCode = String((c.parentCode ?? shaped.parentCode ?? "")).trim();

      

      return {
        ...(c as any),
        ...shaped,
        parentCode,
        entityId,
      } as CustomAccount;
    })
    .filter(a => /^\d+$/.test(a.code));

  // Merge (custom overrides structural by code)
  const byCode = new Map<string, Account>();
  for (const a of structuralTree) byCode.set(a.code, a);
  for (const a of customAccounts) byCode.set(a.code, a);

  const effectiveAccounts = Array.from(byCode.values()).sort((a, b) =>
    a.code.localeCompare(b.code, "es", { numeric: true })
  );

  const { postableAccounts, postableCodeSet } = 
    computePostables(effectiveAccounts);

  if (import.meta.env.DEV) {
  console.log("Effective accounts total:", effectiveAccounts.length);
  console.log("Postable accounts total:", postableAccounts.length);
  };

  return {
    structuralTree,
    customAccounts,
    effectiveAccounts,

    postableAccounts,
    postableCodeSet,

    // backward compatibility aliases
    leafAccounts: postableAccounts,
    leafCodeSet: postableCodeSet,

    structuralCodeSet,
  };
}