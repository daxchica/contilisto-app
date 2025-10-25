// utils/groupJournalEntries.ts
import { JournalEntry } from "../types/JournalEntry";

export function groupEntriesByAccount(entries: JournalEntry[]) {
  const grouped: Record<string, { debit: number; credit: number; initial: number }> = {};

  for (const entry of entries) {
    const code = entry.account_code;
    if (!grouped[code]) {
      grouped[code] = { debit: 0, credit: 0, initial: 0 };
    }

    if (entry.source === "initial") {
      grouped[code].initial += (entry.debit ?? 0) - (entry.credit ?? 0);
    } else {
      grouped[code].debit += entry.debit ?? 0;
      grouped[code].credit += entry.credit ?? 0;
    }

    // 🔹 Propagar a los padres jerárquicos
    let parent = getParentCode(code);
    while (parent) {
      if (!grouped[parent]) {
        grouped[parent] = { debit: 0, credit: 0, initial: 0 };
      }

      if (entry.source === "initial") {
        grouped[parent].initial += (entry.debit ?? 0) - (entry.credit ?? 0);
      } else {
        grouped[parent].debit += entry.debit ?? 0;
        grouped[parent].credit += entry.credit ?? 0;
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