// src/services/controlAccounts.ts
const normAcc = (c?: string) => (c || "").replace(/\./g, "").trim();

// ✅ Put here the real prefixes you use in your COA
export const RECEIVABLE_PREFIXES = ["10103"];
export const PAYABLE_PREFIXES = ["20101", "21101"];

export function isCustomerReceivableAccount(code?: string) {
  const c = normAcc(code);
  return RECEIVABLE_PREFIXES.some((p) => c.startsWith(p));
}

export function isSupplierPayableAccount(code?: string) {
  const c = normAcc(code);
  return PAYABLE_PREFIXES.some((p) => c.startsWith(p));
}