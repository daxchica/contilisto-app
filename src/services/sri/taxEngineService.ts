// ============================================================================
// src/services/sri/taxEngineService.ts
// CONTILISTO — Unified Ecuador Tax Engine (PRODUCTION SAFE)
// Shared source of truth for IVA 104 + Formulario 103 + ATS
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";
import type { Entity } from "@/types/Entity";
import type { TaxLedgerEntry, TaxLedgerType, TaxTransactionType } from "@/types/TaxLedgerEntry";
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

function norm(code?: string): string {
  return String(code ?? "").replace(/\./g, "").trim();
}

function samePeriod(date: unknown, period: string): boolean {
  return String(date ?? "").slice(0, 7) === period;
}

function firstNonEmpty(...values: Array<unknown>): string {
  for (const value of values) {
    const s = String(value ?? "").trim();
    if (s) return s;
  }
  return "";
}

function startsWithAny(code: string, prefixes: string[]): boolean {
  return prefixes.some((p) => code.startsWith(norm(p)));
}

function inferTransactionType(entries: JournalEntry[]): TaxTransactionType {
  if (entries.some((e) => e.transactionType === "transfer")) return "transfer";
  if (entries.some((e) => e.transactionType === "payment")) return "payment";
  return "invoice";
}

function inferDocumentNature(entries: JournalEntry[]): "sale" | "purchase" {
  const hasPurchaseSignals = entries.some((e) => {
    const code = norm(e.account_code);
    return (
      code.startsWith("5") ||
      code.startsWith("6") ||
      code.startsWith("133") ||
      code.startsWith("20103") ||
      !!String(e.supplier_name ?? e.issuerName ?? "").trim()
    );
  });

  if (hasPurchaseSignals) return "purchase";
  return "sale";
}

function inferLedgerType(
  transactionType: TaxTransactionType,
  documentNature: "sale" | "purchase",
  ivaRetentionPaid: number,
  rentaRetentionPaid: number,
  ivaRetentionReceived: number,
  rentaRetentionReceived: number
): TaxLedgerType {
  const hasRetentionOnly =
    transactionType === "payment" &&
    ivaRetentionPaid + rentaRetentionPaid > 0;

  if (hasRetentionOnly) return "retention";
  if (documentNature === "sale") return "sale";
  if (documentNature === "purchase") return "purchase";

  if (ivaRetentionReceived + rentaRetentionReceived > 0) return "sale";
  return "purchase";
}

function sumCreditByPrefix(entries: JournalEntry[], prefixes: string[]): number {
  return n2(
    entries
      .filter((e) => startsWithAny(norm(e.account_code), prefixes))
      .reduce((sum, e) => sum + n2(e.credit), 0)
  );
}

function sumDebitByPrefix(entries: JournalEntry[], prefixes: string[]): number {
  return n2(
    entries
      .filter((e) => startsWithAny(norm(e.account_code), prefixes))
      .reduce((sum, e) => sum + n2(e.debit), 0)
  );
}

function inferPurchaseBase12(entries: JournalEntry[], purchaseIva: number): number {
  const explicitExpenseBase = n2(
    entries
      .filter((e) => {
        const code = norm(e.account_code);
        return (code.startsWith("5") || code.startsWith("6")) && n2(e.debit) > 0;
      })
      .reduce((sum, e) => sum + n2(e.debit), 0)
  );

  if (purchaseIva <= 0) return explicitExpenseBase;

  const inferredFromIva = n2(purchaseIva / 0.12);

  if (explicitExpenseBase <= 0) return inferredFromIva;

  return Math.min(explicitExpenseBase, inferredFromIva);
}

function inferPurchaseBase0(entries: JournalEntry[], purchaseIva: number): number {
  if (purchaseIva > 0) return 0;

  return n2(
    entries
      .filter((e) => {
        const code = norm(e.account_code);
        return (code.startsWith("5") || code.startsWith("6")) && n2(e.debit) > 0;
      })
      .reduce((sum, e) => sum + n2(e.debit), 0)
  );
}

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
    if (!samePeriod(e.date, period)) return false;
    if (e.source === "initial") return false;
    return true;
  });

  const grouped = new Map<string, JournalEntry[]>();

  for (const entry of filtered) {
    const tx = String(entry.transactionId ?? "").trim();
    if (!tx) continue;

    if (!grouped.has(tx)) grouped.set(tx, []);
    grouped.get(tx)!.push(entry);
  }

  const ledger: TaxLedgerEntry[] = [];

  for (const [transactionId, txEntries] of grouped) {
    const main = txEntries[0];
    if (!main) continue;

    const transactionType = inferTransactionType(txEntries);
    const documentNature = inferDocumentNature(txEntries);

    // =========================
    // SALES
    // =========================
    const salesBase12 = sumCreditByPrefix(txEntries, ["4"]);
    const salesBase0 = 0;
    const salesIva = sumCreditByPrefix(txEntries, ["2010201"]);

    // =========================
    // PURCHASES
    // =========================
    const purchaseIva = sumDebitByPrefix(txEntries, ["133"]);
    const purchaseBase12 = inferPurchaseBase12(txEntries, purchaseIva);
    const purchaseBase0 = inferPurchaseBase0(txEntries, purchaseIva);

    // =========================
    // RETENTIONS RECEIVED
    // =========================
    const ivaRetentionReceived = sumDebitByPrefix(txEntries, ["1130202"]);
    const rentaRetentionReceived = sumDebitByPrefix(txEntries, ["1130201"]);

    // =========================
    // RETENTIONS PAID
    // =========================
    const ivaRetentionPaid = sumCreditByPrefix(txEntries, ["201020202"]);
    const rentaRetentionPaid = sumCreditByPrefix(txEntries, ["201020201"]);

    const type = inferLedgerType(
      transactionType,
      documentNature,
      ivaRetentionPaid,
      rentaRetentionPaid,
      ivaRetentionReceived,
      rentaRetentionReceived
    );

    const documentNumber = firstNonEmpty(main.invoice_number);
    const documentType =
      firstNonEmpty(main.tax?.document?.type) ||
      (type === "retention" ? "07" : documentNature === "sale" ? "18" : "01");

    const authorizationNumber = firstNonEmpty(main.tax?.document?.authorization);
    const paymentMethod = firstNonEmpty(main.tax?.payment?.method);

    const counterpartyRUC =
      documentNature === "purchase"
        ? firstNonEmpty(main.supplier_ruc, main.issuerRUC, main.tax?.supplier?.ruc)
        : firstNonEmpty(main.customer_ruc, main.customerRUC);

    const counterpartyName =
      documentNature === "purchase"
        ? firstNonEmpty(main.supplier_name, main.issuerName, main.tax?.supplier?.name)
        : firstNonEmpty(main.customer_name);

    const base12 = documentNature === "sale" ? salesBase12 : purchaseBase12;
    const base0 = documentNature === "sale" ? salesBase0 : purchaseBase0;
    const iva = documentNature === "sale" ? salesIva : purchaseIva;

    ledger.push({
      entityId,
      transactionId,
      date: String(main.date ?? "").slice(0, 10),
      period,

      type,
      transactionType,
      documentNature,

      documentNumber,
      documentType,
      authorizationNumber,
      paymentMethod,

      ruc: counterpartyRUC,
      name: counterpartyName,

      counterpartyRUC,
      counterpartyName,

      base12,
      base0,
      iva,

      salesBase12,
      salesBase0,
      salesIva,

      purchaseBase12,
      purchaseBase0,
      purchaseIva,

      ivaRetentionReceived,
      rentaRetentionReceived,

      ivaRetentionPaid,
      rentaRetentionPaid,

      retentionIva: ivaRetentionPaid,
      retentionRenta: rentaRetentionPaid,

      sourceEntries: txEntries,
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
  const ret103Summary = generateRet103Summary(ledger, entityId, period);
  const atsDocuments = buildAtsDocuments(ledger, entityId, period);

  const errors: string[] = [];
  const warnings: string[] = [];

  const hasActivity =
    ivaSummary.ventas12 > 0 ||
    ivaSummary.compras12 > 0 ||
    ivaSummary.ivaVentas > 0 ||
    ivaSummary.ivaCompras > 0 ||
    ret103Summary?.ivaRetenido > 0 ||
    ret103Summary?.rentaRetenida > 0;

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