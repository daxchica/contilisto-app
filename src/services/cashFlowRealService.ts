// src/services/cashFlowRealService.ts

import type { BankMovement } from "@/types/bankTypes";
import { fetchBankMovements } from "@/services/bankMovementService";

import {
  collection,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db } from "@/firebase-config";
import { requireEntityId } from "./requireEntityId";

import type { CashflowCategory, CashflowDirection } from "@/types/UnifiedCashflow";
import type { JournalEntry } from "@/types/JournalEntry";
import { isSupplierPayableAccount, isCustomerReceivableAccount } from "@/services/controlAccounts";


function resolveDirection(amount: number): CashflowDirection {
  return amount >= 0 ? "in" : "out";
}

function normalizeDate(input?: string | number): string | undefined {
  if (input === undefined || input === null || input === "") return undefined;

  if (typeof input === "number") {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function safeId(m: BankMovement, idx: number): string {
  return (m as any).id ?? `${m.date ?? "no-date"}_${idx}`;
}

/**
 * Rule set based on Ecuador COA structure and this company's controlAccounts:
 * - 4 (Ingresos) & 5 (Gastos): Operating
 * - CxC (isCustomerReceivableAccount): Operating — invoice collections
 * - CxP (isSupplierPayableAccount): Operating — invoice payments
 * - transactionType "payment" or "collection": Operating (journal-level signal)
 * - 12/13 (Activos fijos / inversiones): Investing
 * - 21/22 (Deudas/Préstamos — outside CxP range): Financing (CxP wins first)
 * - else: Uncategorized
 */
function classifyByAccountCode(code?: string, txType?: string): CashflowCategory {
  if (!code && !txType) return "uncategorized";
  // Journal-level transaction type is the most reliable signal
  if (txType === "payment" || txType === "collection") return "operating";
  if (!code) return "uncategorized";
  if (code.startsWith("4") || code.startsWith("5")) return "operating";
  // Use the same prefix rules as the rest of the app (controlAccounts.ts)
  if (isCustomerReceivableAccount(code) || isSupplierPayableAccount(code)) return "operating";
  if (code.startsWith("12") || code.startsWith("13")) return "investing";
  if (code.startsWith("21") || code.startsWith("22")) return "financing";
  return "uncategorized";
}

/**
 * Fetch journal entries by transaction id so we can infer category.
 * We keep it light + cached.
 */
const txCategoryCache = new Map<string, CashflowCategory>();

async function resolveCategorySmart(
  entityId: string,
  transactionId?: string,
  relatedInvoiceId?: string
): Promise<CashflowCategory> {
  requireEntityId(entityId, "resolver categoría de flujo");
  // Any movement tied directly to an invoice is an operational cash flow
  if (relatedInvoiceId) return "operating";
  if (!transactionId) return "uncategorized";
  if (txCategoryCache.has(transactionId)) {
    return txCategoryCache.get(transactionId)!;
  }

  const colRef = collection(db, "entities", entityId, "journalEntries");

  // NOTE: Adjust the field name if yours is `transactionId` or `relatedJournalTransactionId`
  const q = query(
    colRef,
    where("transactionId", "==", transactionId),
    limit(50)
  );

  const snap = await getDocs(q);

  let category: CashflowCategory = "uncategorized";

  snap.forEach((doc) => {
    const e = doc.data() as JournalEntry;

    // Pass both account code AND transactionType — whichever gives the clearest signal
    const c = classifyByAccountCode(e.account_code, e.transactionType);

    if (c === "financing") category = "financing";
    else if (c === "investing" && category !== "financing") category = "investing";
    else if (c === "operating" && category === "uncategorized") category = "operating";
  });

  txCategoryCache.set(transactionId, category);
  return category;
}

export interface RealCashflowEvent {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // signed
  direction: CashflowDirection;
  category: CashflowCategory;
  description: string;
  bankAccountId: string;
  reference?: string;
}

export interface RealCashflowResult {
  events: RealCashflowEvent[];
  totals: {
    inflow: number;
    outflow: number;
    net: number;
    byCategory: Record<CashflowCategory, number>;
  };
}

export async function getRealCashBeforeDate(
  entityId: string,
  beforeDate: string
): Promise<number> {
  requireEntityId(entityId, "cargar flujo real");
  const movements = await fetchBankMovements(
    entityId,
    undefined,
    undefined,
    beforeDate
  );

  let total = 0;

  for (const m of movements) {
    const date = m.date;
    if (!date) continue;

    if (normalizeDate(date) && normalizeDate(date)! < beforeDate) {
      total += Number((m as any).amount) || 0;
    }
  }

  return total;
}

export async function getRealCashFlow(
  entityId: string,
  from?: string | number,
  to?: string | number
): Promise<RealCashflowResult> {
  requireEntityId(entityId, "cargar flujo real");
  // Clear per-call so a change in period doesn't serve stale categories
  txCategoryCache.clear();
  const fromDate = normalizeDate(from);
  const toDate = normalizeDate(to);

  const movements = await fetchBankMovements(entityId, undefined, fromDate, toDate);

  const events: RealCashflowEvent[] = [];

  for (let idx = 0; idx < movements.length; idx++) {
    const m = movements[idx];
    const amount = Number((m as any).amount) || 0;

    let category = await resolveCategorySmart(
      entityId,
      m.relatedJournalTransactionId,
      m.relatedInvoiceId
    );

    // Last-resort fallback: description patterns written exclusively by the
    // payment/collection flows — catches movements that were saved without
    // a relatedJournalTransactionId (older entries or reconciliation paths).
    if (category === "uncategorized") {
      const desc = ((m as any).description ?? "").trimStart();
      if (
        desc.startsWith("Pago fact.") ||
        desc.startsWith("Cobro fact.") ||
        desc.startsWith("Cobro factura") ||
        desc.startsWith("Pago factura")
      ) {
        category = "operating";
      }
    }

    events.push({
      id: safeId(m, idx),
      date: (m as any).date,
      amount,
      direction: resolveDirection(amount),
      category,
      description: (m as any).description ?? "Movimiento bancario",
      bankAccountId: (m as any).bankAccountId,
      reference: (m as any).reference,
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  const byCategory: Record<CashflowCategory, number> = {
    operating: 0,
    investing: 0,
    financing: 0,
    uncategorized: 0,
  };

  let inflow = 0;
  let outflow = 0;
  let net = 0;

  for (const e of events) {
    byCategory[e.category] += e.amount;
    net += e.amount;
    if (e.amount >= 0) inflow += e.amount;
    else outflow += Math.abs(e.amount);
  }

  return { events, totals: { inflow, outflow, net, byCategory } };
}
