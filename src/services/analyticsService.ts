// src/services/analyticsService.ts

import { db } from "../firebase-config";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { JournalEntry } from "../types/JournalEntry";

/**
 * Retorna las cuentas más usadas por un usuario en una empresa.
 * Agrupa por account_code y devuelve los más frecuentes.
 */
export async function getTopUsedAccounts(
  userId: string,
  entityId: string,
  limit = 5
): Promise<string[]> {
  const entriesRef = collection(db, "journalEntries");
  const q = query(entriesRef, where("userId", "==", userId), where("entityId", "==", entityId));
  const snapshot = await getDocs(q);

  const accountUsage: Record<string, number> = {};

  snapshot.forEach((doc) => {
    const data = doc.data() as JournalEntry;
    if (data.account_code) {
      accountUsage[data.account_code] = (accountUsage[data.account_code] || 0) + 1;
    }
  });

  return Object.entries(accountUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([code]) => code);
}