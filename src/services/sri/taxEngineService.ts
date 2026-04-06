// ============================================================================
// src/services/sri/taxEngineService.ts
// CONTILISTO — Unified Ecuador Tax Engine (PRODUCTION SAFE FIXED)
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";
import type { Entity } from "@/types/Entity";
import type { TaxLedgerEntry } from "@/types/TaxLedgerEntry";
import type { IvaDeclarationSummary } from "@/types/sri";
import type { AtsDocument } from "@/types/atsDocument";

import { buildIva104SummaryFromLedger } from "./iva104Service";
import { buildAtsDocuments } from "./atsDocumentAggregator";
import { generateRet103Summary } from "./generateRet103";

/* =============================================================================
   TYPES
============================================================================= */

export interface TaxEngineValidation {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface TaxEngineResult {
  period: string;
  ledger: TaxLedgerEntry[];
  ivaSummary: IvaDeclarationSummary;
  ret103Summary: any;
  atsDocuments: AtsDocument[];
  validation: TaxEngineValidation;
}

/* =============================================================================
   HELPERS
============================================================================= */

function n2(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

const norm = (c?: string) =>
  String(c ?? "").replace(/\./g, "").trim();

/* =============================================================================
   LEDGER BUILDER
============================================================================= */

export function buildTaxLedger(
  entries: JournalEntry[],
  entityId: string,
  period: string,
  entity?: Entity
): TaxLedgerEntry[] {

  const filtered = entries.filter((e) => {
    if (!e) return false;
    if (e.entityId !== entityId) return false;
    if (!String(e.date).startsWith(period)) return false;
    if (e.source === "initial") return false;
    return true;
  });

  const grouped = new Map<string, JournalEntry[]>();

  for (const e of filtered) {
    const tx = String(e.transactionId ?? "").trim();
    if (!tx) continue;

    if (!grouped.has(tx)) grouped.set(tx, []);
    grouped.get(tx)!.push(e);
  }

  const ledger: TaxLedgerEntry[] = [];

  for (const [transactionId, txEntries] of grouped) {
    const main = txEntries[0];
    if (!main) continue;

    // =========================
    // CALCULATIONS
    // =========================

    const salesBase12 = n2(
      txEntries
        .filter((e) => norm(e.account_code).startsWith("4"))
        .reduce((sum, e) => sum + Number(e.credit || 0), 0)
    );

    const salesIva = n2(
      txEntries
        .filter((e) => norm(e.account_code).startsWith("2010201"))
        .reduce((sum, e) => sum + Number(e.credit || 0), 0)
    );

    const purchaseIva = n2(
      txEntries
        .filter((e) => norm(e.account_code).startsWith("133"))
        .reduce((sum, e) => sum + Number(e.debit || 0), 0)
    );

    const purchaseBase12 = purchaseIva > 0 ? n2(purchaseIva / 0.12) : 0;

    // =========================
    // CLASSIFICATION
    // =========================

    const isSale = txEntries.some(e =>
      norm(e.account_code).startsWith("4")
    );

    const isPurchase = txEntries.some(e =>
      norm(e.account_code).startsWith("5") ||
      norm(e.account_code).startsWith("133")
    );

    const type: "sale" | "purchase" =
      isSale && !isPurchase ? "sale" : "purchase";

    // =========================
    // DEBUG
    // =========================

    console.log("🧾 TX:", transactionId);
    console.log("➡️ salesBase12:", salesBase12);
    console.log("➡️ salesIva:", salesIva);
    console.log("➡️ purchaseIva:", purchaseIva);

    // =========================
    // PUSH TO LEDGER
    // =========================

    ledger.push({
      entityId,

      transactionId,
      date: String(main.date ?? "").slice(0, 10),
      period,

      documentNumber: String(main.invoice_number ?? "").trim(),

      type,

      ruc: main.supplier_ruc || main.customer_ruc || "",
      name: main.supplier_name || main.customer_name || "",

      base12: salesBase12 > 0 ? salesBase12 : purchaseBase12,
      base0: 0,
      iva: salesIva > 0 ? salesIva : purchaseIva,

      retentionIva: 0,
      retentionRenta: 0,

      sourceEntries: txEntries,

      counterpartyName:
        main.supplier_name || main.customer_name || "",

      counterpartyRUC:
        main.supplier_ruc || main.customer_ruc || "",

      salesBase12,
      salesBase0: 0,

      purchaseBase12,
      purchaseBase0: 0,

      rentaRetentionReceived: 0,

      ivaRetentionPaid: 0,
      rentaRetentionPaid: 0,
    });
  }

  return ledger;
}

/* =============================================================================
   MAIN ENGINE
============================================================================= */

export function runTaxEngine(
  entries: JournalEntry[],
  entityId: string,
  period: string,
  entity?: Entity
): TaxEngineResult {

  const ledger = buildTaxLedger(entries, entityId, period, entity);

  const ivaSummary = buildIva104SummaryFromLedger(ledger, period);

  const ret103Summary = generateRet103Summary(
    ledger,
    entityId,
    period
  );

  const atsDocuments = buildAtsDocuments(ledger, entityId, period);

  const errors: string[] = [];
  const warnings: string[] = [];

  const hasActivity =
    ivaSummary.ventas12 > 0 ||
    ivaSummary.compras12 > 0 ||
    ivaSummary.ivaVentas > 0 ||
    ivaSummary.ivaCompras > 0;

  if (!hasActivity) {
    errors.push("No existen movimientos contables en el período");
  }

  return {
    period,
    ledger,
    ivaSummary,
    ret103Summary,
    atsDocuments,
    validation: {
      valid: errors.length === 0,
      errors,
      warnings,
    },
  };
}