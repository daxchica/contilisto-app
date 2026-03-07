// ============================================================================
// src/types/TaxLedgerEntry.ts
// CONTILISTO — Normalized Tax Ledger Entry
// ============================================================================

export type TaxLedgerType = "sale" | "purchase" | "retention";

export interface TaxLedgerEntry {
  entityId: string;

  documentId?: string;
  documentNumber?: string;

  date: string;
  period: string;

  type: TaxLedgerType;

  ruc?: string;
  name?: string;

  base12: number;
  base0: number;
  iva: number;

  retentionIva?: number;
  retentionRenta?: number;

  authorizationNumber?: string;
  paymentMethod?: string;
}