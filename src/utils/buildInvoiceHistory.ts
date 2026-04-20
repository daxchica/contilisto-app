// ============================================================================
// src/utils/buildInvoiceHistory.ts
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";

export type InvoiceHistory = {
  partnerName: string;
  partnerRUC: string;
  invoiceNumber: string;
  issueDate: string;
  total: number;
  paid: number;
  balance: number;
  lastPaymentDate?: string;
  status: "paid" | "partial" | "pending";
  entries: JournalEntry[];
};

export function buildInvoiceHistory(
  entries: JournalEntry[],
  type?: string | null
) {
  const map = new Map<string, InvoiceHistory>();

  // =========================
  // 1. BUILD FULL INVOICES
  // =========================
  for (const e of entries) {
    if (!e.invoice_number) continue;
    if (e.source === "initial") continue; // 🚫 remove balance inicial

    const key = e.invoice_number;

    if (!map.has(key)) {
      map.set(key, {
        partnerName:
          e.supplier_name || 
          e.customer_name || 
          e.description || 
          "SIN NOMBRE",
        
        partnerRUC:
          e.supplier_ruc ||
          e.customerRUC ||
          e.issuerRUC ||
          "",
        invoiceNumber: key,
        issueDate: e.date,
        total: 0,
        paid: 0,
        balance: 0,
        status: "pending",
        entries: [],
      });
    }

    const inv = map.get(key)!;
    const code = e.account_code || "";

    const isAR = code.startsWith("10103");
    const isAP = code.startsWith("20103");
    const isBank = code.startsWith("10101");

    // =========================
    // FACTURA ORIGINAL
    // =========================
    if ((isAR || isAP) && inv.total === 0) {
      // only count ONCE (prevents duplication)
        inv.total = (e.debit ?? 0) > 0
          ? (e.debit ?? 0)
          : (e.credit ?? 0);
    }
    
    // =========================
    // PAYMENTS (ONLY BANK)
    // =========================
    if (isBank) {
      const amount =
        (e.debit ?? 0) > 0
          ? (e.debit ?? 0)
          : (e.credit ?? 0);

      inv.paid += amount;
      inv.lastPaymentDate = e.date;
    }

    inv.entries.push(e);
  }

  // =========================
  // 2. FINAL CALCULATION
  // =========================
  const result: InvoiceHistory[] = [];

  for (const inv of map.values()) {
    inv.balance = inv.total - inv.paid;

    if (inv.balance <= 0) {
      inv.status = "paid";
    } else if (inv.paid > 0) {
      inv.status = "partial";
    } else {
      inv.status = "pending";
    }

    result.push(inv);
  }

  // =========================
  // 3. FILTER BY TYPE (NOW SAFE)
  // =========================
  const filtered = result.filter((inv) => {
    const hasAR = inv.entries.some(e =>
      (e.account_code || "").startsWith("10103")
    );

    const hasAP = inv.entries.some(e =>
      (e.account_code || "").startsWith("20103")
    );

    if (type === "ar") return hasAR;
    if (type === "ap") return hasAP;

    return true;
  });

  // =========================
  // 4. CLEAN INVALID INVOICES
  // =========================
  return filtered.filter((inv) => inv.total > 0);
}