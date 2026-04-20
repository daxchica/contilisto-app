// ============================================================================
// CONTILISTO — TAX DOCUMENT (NORMALIZED CORE — IMPROVED)
// SAFE UPGRADE — BACKWARD COMPATIBLE + ATS READY
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";

export type TaxDocumentType = "sale" | "purchase";

export interface TaxDocument {
  /* ---------------------------------------------------------------------- */
  /* CORE IDENTIFICATION                                                    */
  /* ---------------------------------------------------------------------- */

  entityId: string;
  transactionId: string;

  date: string;
  period: string;

  type: TaxDocumentType;

  /* ---------------------------------------------------------------------- */
  /* DOCUMENT                                                               */
  /* ---------------------------------------------------------------------- */

  documentNumber?: string;
  authorizationNumber?: string;
  documentType?: string; // factura, notaCredito, etc.

  estab?: string;
  ptoEmi?: string;
  secuencial?: string;

  /* ---------------------------------------------------------------------- */
  /* COUNTERPARTY                                                           */
  /* ---------------------------------------------------------------------- */

  counterpartyRUC?: string;
  counterpartyName?: string;

  /* ---------------------------------------------------------------------- */
  /* BASES                                                                  */
  /* ---------------------------------------------------------------------- */

  base12: number;
  base0: number;
  baseNoObjeto: number;

  /* ---------------------------------------------------------------------- */
  /* TAXES (SEPARATED — CRITICAL FIX)                                       */
  /* ---------------------------------------------------------------------- */

  ivaVentas: number;   // IVA generado (sales)
  ivaCompras: number;  // IVA crédito (purchases)

  ice: number;

  /* ---------------------------------------------------------------------- */
  /* RETENTIONS                                                             */
  /* ---------------------------------------------------------------------- */

  ivaRetention: number;
  rentaRetention: number;

  /* ---------------------------------------------------------------------- */
  /* DERIVED / HELPER (OPTIONAL — SAFE)                                     */
  /* ---------------------------------------------------------------------- */

  total?: number; // base12 + base0 + baseNoObjeto + iva + ice

  /* ---------------------------------------------------------------------- */
  /* TRACEABILITY                                                           */
  /* ---------------------------------------------------------------------- */

  sourceEntries: JournalEntry[];
}