// ============================================================================
// src/types/TaxLedgerEntry.ts
// CONTILISTO — Normalized Tax Ledger Entry (PRODUCTION)
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";

export type TaxDocumentNature = "sale" | "purchase";
export type TaxTransactionType = "invoice" | "payment" | "transfer";
export type TaxLedgerType = "sale" | "purchase" | "retention";

export interface TaxLedgerEntry {
  /* ---------------------------------------------------------------------- */
  /* CORE IDENTIFICATION                                                    */
  /* ---------------------------------------------------------------------- */

  entityId: string;
  transactionId: string;

  date: string;
  period: string;

  type: TaxLedgerType;
  transactionType: TaxTransactionType;
  documentNature?: TaxDocumentNature;

  /* ---------------------------------------------------------------------- */
  /* DOCUMENT                                                               */
  /* ---------------------------------------------------------------------- */

  documentId?: string;
  documentNumber?: string;
  documentType?: string;
  authorizationNumber?: string;
  paymentMethod?: string;

  /* ---------------------------------------------------------------------- */
  /* PARTY                                                                  */
  /* ---------------------------------------------------------------------- */

  ruc?: string;
  name?: string;

  counterpartyRUC?: string;
  counterpartyName?: string;

  /* ---------------------------------------------------------------------- */
  /* GENERIC TAX AMOUNTS                                                    */
  /* ---------------------------------------------------------------------- */

  base12: number;
  base0: number;
  iva: number;

  /* ---------------------------------------------------------------------- */
  /* SALES (OUTPUT TAX)                                                     */
  /* ---------------------------------------------------------------------- */

  salesBase12: number;
  salesBase0: number;
  salesIva: number;

  /* ---------------------------------------------------------------------- */
  /* PURCHASES (INPUT TAX)                                                  */
  /* ---------------------------------------------------------------------- */

  purchaseBase12: number;
  purchaseBase0: number;
  purchaseIva: number;

  /* ---------------------------------------------------------------------- */
  /* RETENTIONS                                                             */
  /* ---------------------------------------------------------------------- */

  ivaRetentionReceived: number;
  rentaRetentionReceived: number;

  ivaRetentionPaid: number;
  rentaRetentionPaid: number;

  // Generic aliases for easier consumers like Form 103
  retentionIva?: number;
  retentionRenta?: number;

  /* ---------------------------------------------------------------------- */
  /* TRACEABILITY                                                           */
  /* ---------------------------------------------------------------------- */

  sourceEntries: JournalEntry[];
}