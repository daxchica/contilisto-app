// ============================================================================
// src/services/rebuildPayablesFromJournal.ts
// CONTILISTO — Rebuild Accounts Payable Subledger
// Reconstructs AP ledger from journal entries
// FIXES:
// - Prevent sales invoices appearing in AP
// - Only detect supplier invoice control accounts (20103)
// - Skip VAT / retention liabilities
// ============================================================================

import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase-config";

import type { JournalEntry } from "@/types/JournalEntry";
import { upsertPayable } from "@/services/payablesService";

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function norm(code?: string) {
  return (code || "").replace(/\./g, "").trim();
}

function isParentAccount(code?: string) {
  const c = norm(code);
  return c.length <= 7;
}

/**
 * TRUE AP control account
 * Ecuador supplier invoices normally live in:
 *
 * 20103xxxx
 */
function isAPInvoiceControlAccount(code?: string) {
  const c = norm(code);
  return c.startsWith("20103") && !isParentAccount(c);
}

/**
 * Detect sales transactions
 * If transaction contains revenue account (4xxxx)
 * it must NEVER be treated as AP
 */
function groupLooksLikeSale(group: JournalEntry[]) {
  return group.some(
    (e) => norm(e.account_code).startsWith("4") && (e.credit ?? 0) > 0
  );
}

/**
 * Clean OCR garbage from supplier name
 */
function cleanSupplierName(raw?: string): string {
  if (!raw) return "";

  let name = raw.trim();

  // remove "Factura 001-001-000000123 —"
  name = name.replace(/^Factura\s+[0-9\-]+\s+—\s*/i, "");

  const badPatterns = [
    /^DIR\.?\s*CONTRIBUYENTE/i,
    /^AUTORIZACI[ÓO]N/i,
    /^S\.A\.?\s*AUTORIZACI[ÓO]N/i,
  ];

  if (badPatterns.some((r) => r.test(name))) {
    return "";
  }

  return name;
}

/* ============================================================================
 * REBUILD PAYABLES
 * ========================================================================== */

export async function rebuildPayablesFromJournal(entityId: string) {

  const journalCol = collection(
    db,
    "entities",
    entityId,
    "journalEntries"
  );

  const snap = await getDocs(journalCol);

  const entries = snap.docs.map((d) => d.data() as JournalEntry);

  const grouped = new Map<string, JournalEntry[]>();

  /* -------------------------------------------------------------------------
   * GROUP BY TRANSACTION
   * ----------------------------------------------------------------------- */

  for (const e of entries) {
    if (!e.transactionId) continue;

    if (!grouped.has(e.transactionId)) {
      grouped.set(e.transactionId, []);
    }

    grouped.get(e.transactionId)!.push(e);
  }

  /* -------------------------------------------------------------------------
   * PROCESS GROUPS
   * ----------------------------------------------------------------------- */

  for (const [tx, group] of grouped) {

    // skip initial balances
    if (group.some((e) => e.source === "initial")) continue;

    // skip sales transactions
    if (groupLooksLikeSale(group)) continue;

    /* -----------------------------------------------------------------------
     * Locate AP control account
     * --------------------------------------------------------------------- */

    const control = group.find(
      (e) =>
        isAPInvoiceControlAccount(e.account_code) &&
        (e.credit ?? 0) > 0
    );

    if (!control) continue;

    if (
      !control.transactionId ||
      !control.account_code ||
      !control.invoice_number ||
      !control.date
    ) {
      continue;
    }

    const total = control.credit ?? 0;

    if (total <= 0) continue;

    /* -----------------------------------------------------------------------
     * Supplier Name Detection
     * --------------------------------------------------------------------- */

    let supplierName =
      String(
        (control as any).supplier_name ??
        (control as any).issuerName ??
        (control as any).issuer_name ??
        ""
      ).trim();

    // fallback: extract from description
    if (!supplierName && control.description) {

      const parts = control.description.split("—");

      supplierName =
        parts.length > 1
          ? parts[1].trim()
          : control.description.trim();
    }

    supplierName = cleanSupplierName(supplierName);

    if (!supplierName) supplierName = "PROVEEDOR";

    /* -----------------------------------------------------------------------
     * Supplier RUC
     * --------------------------------------------------------------------- */

    const supplierRUC =
      String(
        (control as any).supplier_ruc ??
        (control as any).supplierRUC ??
        (control as any).issuerRUC ??
        ""
      ).trim();

    /* -----------------------------------------------------------------------
     * CREATE / UPDATE PAYABLE
     * --------------------------------------------------------------------- */

    await upsertPayable(entityId, {

      transactionId: control.transactionId,

      account_code: control.account_code,
      account_name: control.account_name ?? "Proveedores",

      supplierName,
      supplierRUC,

      invoiceNumber: control.invoice_number,
      issueDate: control.date,

      total,
      paid: 0,

      termsDays: 0,
      installments: 1,

      createdFrom: "journal_rebuild",
    });
  }

  console.log("AP rebuild completed");
}