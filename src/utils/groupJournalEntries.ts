// utils/groupJournalEntries.ts
import { JournalEntry } from "../types/JournalEntry";

export type GroupedAccount = {
  initialDebit: number;
  initialCredit: number;
  debit: number;
  credit: number;
};

export function groupEntriesByAccount(
  entries: JournalEntry[],
) {
  const grouped: Record<string, GroupedAccount> = {};

  const ensure = (code: string) => {
    if (!grouped[code]) {
      grouped[code] = { 
        initialDebit: 0,
        initialCredit: 0,
        debit: 0, 
        credit: 0 };
    }
    return grouped[code];
  };

  for (const e of entries) {
    const code = e.account_code?.trim();
    if (!code) continue; 

    const debit = Number(e.debit ?? 0);
    const credit = Number(e.credit ?? 0);

    if (Number.isNaN(debit) || Number.isNaN(credit)) continue;

    const isInitial = e.source == "initial";

    // 1️⃣ Apply to the account itself
    const acc = ensure(code);

    if (isInitial) {
      acc.initialDebit += debit;
      acc.initialCredit += credit;
    } else {
      acc.debit += debit;
      acc.credit += credit;
    }

    // 2️⃣ Propagate to all parents
    let parent = getParentCode(code);
    while (parent) {
      const p = ensure(parent);

      if (isInitial) {
        p.initialDebit += debit;
        p.initialCredit += credit;
      } else {
        p.debit += debit;
        p.credit += credit;
      }

      parent = getParentCode(parent);
    }
  }

  return grouped;
}


function getParentCode(code: string): string | null {
    const len = code.length;

  if (len <= 1) return null;
  if (len <= 3) return code.slice(0, 1);
  if (len <= 5) return code.slice(0, 3);
  if (len <= 7) return code.slice(0, 5);
  if (len <= 9) return code.slice(0, 7);
  if (len <= 11) return code.slice(0, 9);
  return null;
}

export function detectLevel(code: string): number {
  if (code.length === 1) return 1;  // Grupo principal
  if (code.length === 3) return 2;  // Subgrupo
  if (code.length === 5) return 3;  // Cuenta principal
  if (code.length === 7) return 4;  // Subcuenta
  if (code.length === 9) return 5;  // Detalle
  if (code.length === 11) return 6; // Subdetalle
  return 7;                        // Cualquier nivel adicional
}