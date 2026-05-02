// ============================================================================
// src/utils/groupJournalEntries.ts
// CONTILISTO — CORE ACCOUNTING ENGINE
// ============================================================================

import { JournalEntry } from "../types/JournalEntry";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

export type GroupedAccount = {
  account_code: string;
  initial: number;
  debit: number;
  credit: number;
  saldo: number;
};

/* -------------------------------------------------------------------------- */
/* GROUP ENTRIES                                                              */
/* -------------------------------------------------------------------------- */

export function groupEntriesByAccount(
  entries: JournalEntry[],
): Record<string, GroupedAccount> {

  const grouped: Record<string, GroupedAccount> = {};

  for (const e of entries) {

    const code = e.account_code?.trim();

    if (!code) continue;

    const debit = Number(e.debit ?? 0);
    const credit = Number(e.credit ?? 0);

    if (
      Number.isNaN(debit) ||
      Number.isNaN(credit)
    ) {
      continue;
    }

    if (!grouped[code]) {

      grouped[code] = {
        account_code: code,
        initial: 0,
        debit: 0,
        credit: 0,
        saldo: 0,
      };

    }

    const acc = grouped[code];

    // ======================================================================
    // INITIAL BALANCE
    // ======================================================================

    if (e.source === "initial") {

      acc.initial += debit - credit;

    } else {

      acc.debit += debit;
      acc.credit += credit;

    }
  }

  // ========================================================================
  // FINAL SALDO
  // ========================================================================

  for (const acc of Object.values(grouped)) {

    acc.saldo =
      acc.initial +
      acc.debit -
      acc.credit;

  }

  return grouped;
}

/* -------------------------------------------------------------------------- */
/* ROLL-UP ACCOUNTS                                                           */
/* -------------------------------------------------------------------------- */

export function rollupAccounts(
  grouped: Record<string, GroupedAccount>
): Record<string, GroupedAccount> {
  const result: Record<string, GroupedAccount> = {};

  const ensure = (code: string) => {
    if (!result[code]) {
      result[code] = {
        account_code: code,
        initial: 0,
        debit: 0,
        credit: 0,
        saldo: 0,
      };
    }
    return result[code];
  };

  for (const [code, acc] of Object.entries(grouped)) {
    const self = ensure(code);

    self.initial += acc.initial;
    self.debit += acc.debit;
    self.credit += acc.credit;
    self.saldo += acc.saldo;

    let parent = getParentCode(code);

    while (parent) {
      const p = ensure(parent);

      p.initial += acc.initial;
      p.debit += acc.debit;
      p.credit += acc.credit;
      p.saldo += acc.saldo;

      parent = getParentCode(parent);
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* PARENT LOGIC                                                               */
/* -------------------------------------------------------------------------- */

export function getParentCode(
  code: string
): string | null {

  const len = code.length;

  if (len <= 1) return null;

  if (len <= 3) return code.slice(0, 1);

  if (len <= 5) return code.slice(0, 3);

  if (len <= 7) return code.slice(0, 5);

  if (len <= 9) return code.slice(0, 7);

  if (len <= 11) return code.slice(0, 9);

  return null;
}

/* -------------------------------------------------------------------------- */
/* ACCOUNT LEVEL DETECTION                                                    */
/* -------------------------------------------------------------------------- */

export function detectLevel(
  code: string
): number {

  switch (code.length) {

    case 1:
      return 1;

    case 3:
      return 2;

    case 5:
      return 3;

    case 7:
      return 4;

    case 9:
      return 5;

    case 11:
      return 6;

    default:
      return 7;
  }
}