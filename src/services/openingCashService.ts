import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase-config";
import type { JournalEntry } from "@/types/JournalEntry";

/**
 * CASH account detector
 * Ecuador COA typically: 11 = Activo Corriente, and within it 1101 Caja, 1102 Bancos, etc.
 * Adjust prefixes if your chart differs.
 */
const CASH_PREFIXES = ["1101", "1102"]; // keep broad but safe

function isCashAccount(code?: string): boolean {
  if (!code) return false;
  return CASH_PREFIXES.some((p) => code.startsWith(p));
}

/**
 * Accounting balance formula (same logic you already use):
 * - For Asset cash accounts: balance = initial + debit - credit
 * BUT initial entries themselves often come as debit/credit movements.
 * So for source:"initial" entries, we compute net = debit - credit.
 */
function entryNet(e: JournalEntry): number {
  const d = Number(e.debit ?? 0) || 0;
  const c = Number(e.credit ?? 0) || 0;
  return d - c;
}

/**
 * Opening cash as-of a date:
 * Sums all initial-source journal entries for CASH accounts.
 *
 * If you store initial balances as journalEntries with `source: "initial"`,
 * this is the cleanest source of truth.
 */
export async function getOpeningCashBalance(
  entityId: string
): Promise<number> {
  if (!entityId) return 0;

  const colRef = collection(db, "entities", entityId, "journalEntries");

  // Pull only initial-balance entries
  const q = query(colRef, where("source", "==", "initial"));
  const snap = await getDocs(q);

  let total = 0;

  snap.forEach((doc) => {
    const e = doc.data() as JournalEntry;

    if (!isCashAccount(e.account_code)) return;

    total += entryNet(e);
  });

  return total;
}