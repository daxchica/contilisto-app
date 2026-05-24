// ============================================================================
// src/services/reclassifyExpenseService.ts
// CONTILISTO — Reclassify a personal expense as a business journal entry.
//
// Flow:
//  1. Build balanced JournalEntry[] from the PersonalExpenseRecord
//  2. Save to journalEntries via saveJournalEntries (updates balances + payable)
//  3. Delete the PersonalExpenseRecord from personalExpenses
//
// The invoiceLog is left intact — it already points to the correct
// transactionId, and checkProcessedInvoice will now find the live
// journalEntries entry and return true.
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";
import type { PersonalExpenseRecord } from "@/types/PersonalExpenseRecord";
import { saveJournalEntries } from "./journalService";
import { deletePersonalExpensesByTransaction } from "./personalExpenseStorageService";
import { requireEntityId } from "./requireEntityId";

// Standard Ecuador NEC/LORTI account codes (mirrors sriTxtToEntries constants)
const IVA_ACCOUNT_CODE = "1330101";
const IVA_ACCOUNT_NAME = "IVA crédito en compras";
const AP_ACCOUNT_CODE  = "201030102";
const AP_ACCOUNT_NAME  = "Cuentas por pagar";

function n2(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

/**
 * Reclassifies a personal expense as a regular business journal entry.
 *
 * @param entityId          - Firestore entity ID
 * @param uid               - Current user UID
 * @param record            - The PersonalExpenseRecord to reclassify
 * @param expenseAccountCode - Account code to debit (e.g. "502020101")
 * @param expenseAccountName - Human-readable account name
 */
export async function reclassifyPersonalExpenseToJournal(
  entityId: string,
  uid: string,
  record: PersonalExpenseRecord,
  expenseAccountCode: string,
  expenseAccountName: string,
): Promise<void> {
  requireEntityId(entityId, "reclasificar gasto personal");

  if (!expenseAccountCode?.trim()) {
    throw new Error("Debes seleccionar una cuenta contable de gasto.");
  }

  const amount = n2(record.amount);
  const iva    = n2(record.iva);
  const total  = n2(record.total);

  if (amount <= 0) {
    throw new Error("El monto base del gasto debe ser mayor a cero.");
  }

  const desc = [record.description, record.supplierName]
    .filter(Boolean)
    .join(" — ") || `Factura ${record.invoice_number}`;

  const shared = {
    entityId,
    uid,
    transactionId:            record.transactionId,
    transactionType:          "invoice"  as const,
    documentNature:           "purchase" as const,
    date:                     record.date,
    description:              desc,
    invoice_number:           record.invoice_number,
    invoice_number_normalized: record.invoice_number_normalized,
    supplier_name:            record.supplierName,
    supplier_ruc:             record.supplierRUC,
    issuerName:               record.supplierName,
    issuerRUC:                record.supplierRUC,
    source:                   "edited" as const,
    createdAt:                Date.now(),
  };

  const entries: JournalEntry[] = [];

  // ── DR: Expense account ───────────────────────────────────────────────────
  entries.push({
    ...shared,
    id:           crypto.randomUUID(),
    account_code: expenseAccountCode,
    account_name: expenseAccountName,
    debit:        amount,
    credit:       0,
  });

  // ── DR: IVA crédito tributario ────────────────────────────────────────────
  if (iva > 0) {
    entries.push({
      ...shared,
      id:           crypto.randomUUID(),
      account_code: IVA_ACCOUNT_CODE,
      account_name: IVA_ACCOUNT_NAME,
      debit:        iva,
      credit:       0,
    });
  }

  // ── CR: Accounts payable ──────────────────────────────────────────────────
  entries.push({
    ...shared,
    id:           crypto.randomUUID(),
    account_code: AP_ACCOUNT_CODE,
    account_name: AP_ACCOUNT_NAME,
    debit:        0,
    credit:       total,
  });

  // ── Save to journalEntries (also updates account balances + payable) ──────
  // No [Personal:] tag → the personal-expense early-exit is NOT triggered.
  await saveJournalEntries(entityId, uid, entries);

  // ── Remove from personalExpenses ─────────────────────────────────────────
  await deletePersonalExpensesByTransaction(entityId, record.transactionId);
}
