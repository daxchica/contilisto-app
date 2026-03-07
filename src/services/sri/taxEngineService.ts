// ============================================================================
// src/services/sri/taxEngineService.ts
// CONTILISTO — Ecuador Tax Engine
// Central service powering IVA now, ATS later through Document Registry
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";
import type { TaxLedgerEntry } from "@/types/TaxLedgerEntry";

import { buildTaxLedger } from "./taxLedgerBuilder";
import { buildIva104Summary } from "./iva104Service";

/* =============================================================================
   TYPES
============================================================================= */

export interface TaxEngineValidation {
  valid: boolean;
  errors: string[];
}

export interface TaxEngineResult {
  period: string;
  ledger: TaxLedgerEntry[];
  ivaSummary: ReturnType<typeof buildIva104Summary>;
  atsXml?: string;
  validation: TaxEngineValidation;
}

/* =============================================================================
   MAIN TAX ENGINE
============================================================================= */

export async function runTaxEngine(
  entries: JournalEntry[],
  entityId: string,
  period: string
): Promise<TaxEngineResult> {
  const accountMap = {
    // SALES
    ventas12: ["40101", "40102"],
    ventas0: ["40103"],
    
    // IVA SALES
    ivaVentas: ["201020101"],

    // PURCHASES
    compras12: ["50101", "60101"],
    compras0: ["50102", "60102"],

    // IVA CREDIT
    ivaCompras: ["201020201"],

    // RETENTIONS
    retIvaRecibidas: ["201020301"],
  };

  // TEMPORARY:
  // taxLedgerBuilder was refactored to work from AccountingDocument[].
  // Until Declaraciones fetches documents instead of raw journal entries,
  // keep ledger empty here to preserve type safety and app stability.
  const ledger: TaxLedgerEntry[] = [];

  const ivaSummary = buildIva104Summary({
    entries,
    entityId,
    period,
    accountMap,
  });

  const validation: TaxEngineValidation = {
    valid: true,
    errors: [],
  };

  return {
    period,
    ledger,
    ivaSummary,
    atsXml: undefined,
    validation,
  };
}