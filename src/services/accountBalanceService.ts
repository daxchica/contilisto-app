// ============================================================================
// src/services/accountBalanceService.ts
// Maintains account balances per period
// ============================================================================

import { db } from "@/firebase-config";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";

import type { JournalEntry } from "@/types/JournalEntry";

function getPeriod(date: string) {
  return date.slice(0, 7); // YYYY-MM
}

function n(x: any) {
  return Number.isFinite(Number(x)) ? Number(x) : 0;
}

export async function updateAccountBalancesFromJournalEntries(
  entityId: string,
  entries: JournalEntry[]
) {

  const grouped: Record<string, JournalEntry[]> = {};

  for (const e of entries) {

    if (!e.account_code || !e.date) continue;

    const period = getPeriod(e.date);

    const key = `${e.account_code}_${period}`;

    if (!grouped[key]) grouped[key] = [];

    grouped[key].push(e);
  }

  for (const key of Object.keys(grouped)) {

    const [account_code, period] = key.split("_");

    const ref = doc(
      db,
      "entities",
      entityId,
      "accountBalances",
      key
    );

    const snap = await getDoc(ref);

    const existing = snap.exists()
      ? snap.data()
      : {
          openingBalance: 0,
          periodDebit: 0,
          periodCredit: 0,
          closingBalance: 0
        };

    let periodDebit = n(existing.periodDebit);
    let periodCredit = n(existing.periodCredit);

    for (const e of grouped[key]) {

      periodDebit += n(e.debit);
      periodCredit += n(e.credit);
    }

    const openingBalance = n(existing.openingBalance);

    const closingBalance =
      openingBalance + periodDebit - periodCredit;

    await setDoc(
      ref,
      {
        entityId,
        account_code,
        period,
        openingBalance,
        periodDebit,
        periodCredit,
        closingBalance,
        updatedAt: Date.now()
      },
      { merge: true }
    );
  }
}