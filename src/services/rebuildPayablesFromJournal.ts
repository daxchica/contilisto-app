// ============================================================================
// src/services/rebuildPayablesFromJournal.ts
// CONTILISTO — Rebuild Accounts Payable Subledger
// Reconstructs AP ledger from journal entries
// ============================================================================

import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase-config";

import type { JournalEntry } from "@/types/JournalEntry";
import { isSupplierPayableAccount } from "@/services/controlAccounts";
import { upsertPayable } from "@/services/payablesService";

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function cleanSupplierName(raw?: string): string {
  if (!raw) return "";

  let name = raw.trim();

  // remove common prefix: "Factura 001-001-000000123 —"
  name = name.replace(/^Factura\s+[0-9\-]+\s+—\s*/i, "");

  // patterns that are NOT supplier names
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
  const journalCol = collection(db, "entities", entityId, "journalEntries");
  const snap = await getDocs(journalCol);

  const entries = snap.docs.map((d) => d.data() as JournalEntry);

  const grouped = new Map<string, JournalEntry[]>();

  // group entries by transactionId
  for (const e of entries) {
    if (!e.transactionId) continue;

    if (!grouped.has(e.transactionId)) {
      grouped.set(e.transactionId, []);
    }

    grouped.get(e.transactionId)!.push(e);
  }

  for (const [tx, group] of grouped) {

    // skip initial balance entries
    if (group.some((e) => e.source === "initial")) continue;

    // locate the AP control account line
    const control = group.find(
      (e) =>
        isSupplierPayableAccount(e.account_code) &&
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

    // fallback to description
    if (!supplierName && control.description) {
      const parts = control.description.split("—");
      supplierName =
        parts.length > 1 ? parts[1].trim() : control.description.trim();
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
     * Create / Update Payable
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