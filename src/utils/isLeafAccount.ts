// src/utils/isLeafAccount.ts
import type { Account } from "@/types/AccountTypes";

export function isLeafAccount(
  acc: Account,
  all: Account[]
): boolean {
  return !all.some(
    other =>
      other.code !== acc.code &&
      other.code.startsWith(acc.code) &&
      other.code.length === acc.code.length + 2
  );
}