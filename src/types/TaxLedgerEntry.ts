// ============================================================================
// src/types/TaxLedgerEntry.ts
// CONTILISTO — Normalized Tax Ledger Entry (PRODUCTION)
// ============================================================================

import { JournalEntry } from "@/types/JournalEntry";

export type TaxDocumentNature = "sale" | "purchase";

export type TaxTransactionType = "invoice" | "payment" | "transfer";

export interface TaxLedgerEntry {
  /* ---------------------------------------------------------------------- */
  /* CORE IDENTIFICATION                                                    */
  /* ---------------------------------------------------------------------- */

  entityId: string;
  transactionId: string; // 🔥 CRITICAL (grouping + traceability)

  date: string;
  period: string;

  type: "sale" | "purchase";

  ruc?: string;
  name?: string;

  base12: number;
  base0: number;
  iva: number;

  retentionIva?: number;
  retentionRenta?: number;

  documentNumber?: string;
  authorizationNumber?: string;

  /* ---------------------------------------------------------------------- */
  /* COUNTERPARTY                                                           */
  /* ---------------------------------------------------------------------- */

  counterpartyRUC?: string;
  counterpartyName?: string;

  /* ---------------------------------------------------------------------- */
  /* SALES (OUTPUT TAX)                                                     */
  /* ---------------------------------------------------------------------- */

  salesBase12: number;
  salesBase0: number;

  /* ---------------------------------------------------------------------- */
  /* PURCHASES (INPUT TAX)                                                  */
  /* ---------------------------------------------------------------------- */

  purchaseBase12: number;
  purchaseBase0: number;

  /* ---------------------------------------------------------------------- */
  /* RETENTIONS                                                             */
  /* ---------------------------------------------------------------------- */

  rentaRetentionReceived: number;

  ivaRetentionPaid: number; // to customer
  rentaRetentionPaid: number;

  /* ---------------------------------------------------------------------- */
  /* EXTRA (ATS / SRI)                                                      */
  /* ---------------------------------------------------------------------- */

  paymentMethod?: string;

  /* ---------------------------------------------------------------------- */
  /* TRACEABILITY                                                           */
  /* ---------------------------------------------------------------------- */

  sourceEntries: JournalEntry[]; // original journal lines
}