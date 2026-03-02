// ============================================================================
// src/services/cashFlowForecastServices.ts
// CONTILISTO — CASH FLOW QUERY SERVICE
// Supports AR + AP installments (historic + future)
// ============================================================================

import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/firebase-config";
import type { CashFlowItem, CashFlowDirection } from "@/types/CashFlow";
import { requireEntityId } from "./requireEntityId";

// ---------------------------------------------------------------------------
// INTERNAL HELPERS
// ---------------------------------------------------------------------------

function normalizeStatus(
  status: string,
  dueDate: number,
  openAmount: number
): CashFlowItem["status"] {
  const now = Date.now();

  if (openAmount <= 0) return "paid";
  if (status === "partial") return "partial";
  if (dueDate < now) return "overdue";
  return "due";
}

function mapInstallmentToCashFlow(
  raw: any,
  flowDirection: CashFlowDirection
): CashFlowItem {
  return {
    entityId: raw.entityId,
    invoiceId: raw.invoiceId,
    invoiceNumber: raw.invoiceNumber,

    partyName: raw.partyName,
    partyRUC: raw.partyRUC,

    dueDate: raw.dueDate,
    amount: raw.openAmount,
    paidAmount: raw.paidAmount ?? 0,

    flowDirection,
    currency: raw.currency ?? "USD",

    type: raw.type, // "AR" | "AP"
    status: normalizeStatus(raw.status, raw.dueDate, raw.openAmount),
  };
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

/**
 * Fetch cash flow items (AR + AP installments)
 *
 * @param entityId Entity ID
 * @param fromDate Timestamp (ms) — inclusive
 * @param toDate Timestamp (ms) — inclusive
 */
export async function getCashflowForecast(
  entityId: string,
  fromDate: number,
  toDate: number
): Promise<CashFlowItem[]> {
  requireEntityId(entityId, "cargar flujo de caja");
  const results: CashFlowItem[] = [];

  // ---------------------------
  // ACCOUNTS RECEIVABLE (IN)
  // ---------------------------
  const arInvoicesRef = collection(db, "entities", entityId, "arInvoices");
  const arInvoicesSnap = await getDocs(arInvoicesRef);

  for (const invoiceDoc of arInvoicesSnap.docs) {
    const installmentsRef = collection(invoiceDoc.ref, "installments");

    const q = query(
      installmentsRef,
      where("affectsCashFlow", "==", true),
      where("dueDate", ">=", fromDate),
      where("dueDate", "<=", toDate)
    );

    const snap = await getDocs(q);

    snap.forEach((doc) => {
      const data = doc.data();
      results.push(mapInstallmentToCashFlow(data, "in"));
    });
  }

  // ---------------------------
  // ACCOUNTS PAYABLE (OUT)
  // ---------------------------
  const apInvoicesRef = collection(db, "entities", entityId, "apInvoices");
  const apInvoicesSnap = await getDocs(apInvoicesRef);

  for (const invoiceDoc of apInvoicesSnap.docs) {
    const installmentsRef = collection(invoiceDoc.ref, "installments");

    const q = query(
      installmentsRef,
      where("affectsCashFlow", "==", true),
      where("dueDate", ">=", fromDate),
      where("dueDate", "<=", toDate)
    );

    const snap = await getDocs(q);

    snap.forEach((doc) => {
      const data = doc.data();
      results.push(mapInstallmentToCashFlow(data, "out"));
    });
  }

  // ---------------------------
  // SORT BY DATE (ASC)
  // ---------------------------
  results.sort((a, b) => a.dueDate - b.dueDate);

  return results;
}
