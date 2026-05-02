// ============================================================================
// src/types/atsDocument.ts
// CONTILISTO — ATS Document Type (IMPROVED / INTEGRATED)
// ============================================================================

export interface AtsRetention {
  taxType: "IVA" | "RENTA";
  code: string;
  percentage: number;
  base: number;
  amount: number;
}

export interface AtsDocument {
  /* ---------------------------------------------------------------------- */
  /* CORE IDENTITY                                                          */
  /* ---------------------------------------------------------------------- */

  id: string;
  transactionId: string;
  entityId: string;
  period: string;

  /* ---------------------------------------------------------------------- */
  /* DOCUMENT IDENTITY                                                      */
  /* ---------------------------------------------------------------------- */

  documentType: string;
  documentNumber: string;

  establishment?: string;
  emissionPoint?: string;
  sequential?: string;

  authorizationNumber?: string;
  date: string;

  /* ---------------------------------------------------------------------- */
  /* COUNTERPARTY                                                           */
  /* ---------------------------------------------------------------------- */

  counterpartyRUC: string;
  counterpartyName: string;

  // Compatibility aliases used by current ATS validator / legacy code
  ruc?: string;
  razonSocial?: string;

  /* ---------------------------------------------------------------------- */
  /* DOCUMENT NATURE                                                        */
  /* ---------------------------------------------------------------------- */

  type: "sale" | "purchase";

  /* ---------------------------------------------------------------------- */
  /* MONETARY VALUES                                                        */
  /* ---------------------------------------------------------------------- */

  base12: number;
  base0: number;
  baseNoObjeto: number;

  iva: number;
  ice: number;

  total: number;

  /* ---------------------------------------------------------------------- */
  /* RETENTIONS                                                             */
  /* ---------------------------------------------------------------------- */

  ivaRetention: number;
  rentaRetention: number;

  retenciones: AtsRetention[];

  /* ---------------------------------------------------------------------- */
  /* TRACEABILITY                                                           */
  /* ---------------------------------------------------------------------- */

  journalEntryIds: string[];
}