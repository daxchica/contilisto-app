// ============================================================================
// src/services/bankBookService.ts
// ---------------------------------------------------------------------------
// Bank Book Service — CONTILISTO v2.0
//
// Libro Bancos is derived from bankMovements.
// No separate storage.
// ============================================================================

import { fetchBankMovements } from "./bankMovementService";
import type { BankBookEntry } from "../types/bankTypes";

/* ============================================================
 *  FETCH BANK BOOK ENTRIES (Derived from Bank Movements)
 * ============================================================ */
export async function fetchBankBookEntries(
  entityId: string,
  bankAccountId: string
): Promise<BankBookEntry[]> {
  if (!entityId || !bankAccountId) return [];

  const movements = await fetchBankMovements(entityId, bankAccountId);

  let runningBalance = 0;

  return movements
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => {
      runningBalance += m.amount;

      return {
        id: m.id!,
        bankAccountId: m.bankAccountId,
        date: m.date,
        payee: m.payee ?? "",
        amount: m.amount,
        type: m.type,
        description: m.description ?? "",
        status: m.reconciled ? "Conciliado" : "Pendiente",
        balance: runningBalance,
      };
    });
}