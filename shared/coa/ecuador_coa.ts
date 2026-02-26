// shared/coa/ecuador_coa.ts

import type { Account, RawAccount, Nature } from "@/types/AccountTypes";
import raw_coa from "./RAW_COA";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeAccountName(name: string): string {
  return (name ?? "")
    .replaceAll("ÓA", "ÍA")
    .replaceAll("P/BLICAS", "PÚBLICAS")
    .replaceAll("TESORERÓA", "TESORERÍA")
    .replaceAll("ASESORÓA", "ASESORÍA")
    .replaceAll("ENERGÓA", "ENERGÍA")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Infer hierarchical level from code length.
 * Pattern: 1, 101, 10101, 1010101...
 */
function inferLevel(code: string): number {
  if (!code) return 0;
  return Math.max(1, Math.ceil(code.length / 2));
}

/**
 * Infer accounting nature from first digit.
 */
function inferNature(code: string): Nature | undefined {
  if (code.startsWith("1")) return "DEBIT";   // Activo
  if (code.startsWith("5")) return "DEBIT";   // Gastos
  if (code.startsWith("2")) return "CREDIT";  // Pasivo
  if (code.startsWith("3")) return "CREDIT";  // Patrimonio
  if (code.startsWith("4")) return "CREDIT";  // Ingresos
  return undefined;
}

/**
 * Infer parentCode by removing last 2 digits (fallback only).
 */
function inferParentCode(code: string): string | null {
  if (!code || code.length <= 1) return null;
  const parent = code.slice(0, -2);
  return parent.length >= 1 ? parent : null;
}

/**
 * ERP intelligence decoration layer (safe defaults).
 */
function decorateAccount(acc: Account): Account {
  const code = acc.code;

  return {
    ...acc,

    nature: acc.nature ?? inferNature(code),

    // Strategic flags (examples; keep them conservative)
    isReceivable: acc.isReceivable ?? code.startsWith("1010205"),
    isPayable: acc.isPayable ?? code.startsWith("20103"),

    requiresThirdParty:
      acc.requiresThirdParty ??
      (
        code.startsWith("1010205") ||
        code.startsWith("20103") ||
        code.startsWith("5020207")
      ),

    taxType:
      acc.taxType ??
      (code === "101050101"
        ? "VAT_PAID"
        : code === "2130101"
          ? "VAT_COLLECTED"
          : undefined),

    category:
      acc.category ??
      (code.startsWith("5")
        ? "EXPENSE"
        : code.startsWith("4")
          ? "REVENUE"
          : undefined),

    sign:
      acc.sign ??
      (code.startsWith("1") || code.startsWith("5")
        ? "positive"
        : code.startsWith("2") || code.startsWith("3") || code.startsWith("4")
          ? "negative"
          : undefined),
  };
}

/* -------------------------------------------------------------------------- */
/* BUILD ECUADOR COA                                                          */
/* -------------------------------------------------------------------------- */

// Ensure raw_coa is treated as RawAccount[]
const RAW: RawAccount[] = raw_coa as unknown as RawAccount[];

let ECUADOR_COA: Account[] = RAW.map((acc) => {
  const code = String(acc.code ?? "").trim();
  const name = normalizeAccountName(acc.name);

  return {
    code,
    name,
    level: acc.level ?? inferLevel(code),

    parentCode:
      acc.parentCode !== undefined
        ? (acc.parentCode ?? null)
        : inferParentCode(code),

    nature: acc.nature ?? inferNature(code),
    taxType: acc.taxType,
    category: acc.category,

    rate: acc.rate,
    percentage: acc.percentage,
    isDeductible: acc.isDeductible,

    sign: acc.sign,
    isReceivable: acc.isReceivable,
    isPayable: acc.isPayable,
    requiresThirdParty: acc.requiresThirdParty,
    isBank: acc.isBank,
  };
});

// Apply ERP intelligence last (so authored values win)
ECUADOR_COA = ECUADOR_COA.map(decorateAccount);

/* -------------------------------------------------------------------------- */
/* DEV VALIDATION                                                             */
/* -------------------------------------------------------------------------- */

function validateCOA(accounts: Account[]) {
  const seen = new Set<string>();
  const dup = new Set<string>();

  for (const a of accounts) {
    if (!a.code || !/^\d+$/.test(a.code)) {
      console.warn("⚠️ Invalid COA code:", a);
    }
    if (seen.has(a.code)) dup.add(a.code);
    seen.add(a.code);
  }

  if (dup.size) {
    console.warn("⚠️ Duplicate COA codes detected:", [...dup]);
  }

  // Parent warnings (not fatal, but good to see)
  const codeSet = new Set(accounts.map(a => a.code));
  const missingParents = new Set<string>();

  for (const a of accounts) {
    if (a.parentCode && !codeSet.has(a.parentCode)) {
      missingParents.add(`${a.code} -> parent ${a.parentCode}`);
    }
  }

  if (missingParents.size) {
    console.warn("⚠️ Accounts with missing parentCode references:", [...missingParents].slice(0, 50));
  }
}

if (import.meta.env.DEV) {
  validateCOA(ECUADOR_COA);
}

export default ECUADOR_COA;