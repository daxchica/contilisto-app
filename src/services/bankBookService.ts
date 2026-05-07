// ============================================================================
// src/services/bankBookService.ts
// ---------------------------------------------------------------------------
// Bank Book Service — CONTILISTO v2.0
//
// Libro Bancos is derived from bankMovements.
// No separate storage.
// ============================================================================

import { fetchBankMovements } from "@/services/bankMovementService";
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

      // Use payee when available; fall back to description (which carries
      // "Pago fact. XXX — SupplierName" set by journalService).
      const displayPayee = m.payee?.trim() || m.description?.trim() || "";

      return {
        id: m.id!,
        bankAccountId: m.bankAccountId,
        date: m.date,
        payee: displayPayee,
        description: m.description ?? "",
        reference: m.reference ?? "",
        amount: m.amount,
        type: m.type,
        status: m.reconciled ? "Conciliado" : "Pendiente",
        balance: runningBalance,
      };
    });
}