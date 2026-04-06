// src/types/atsDocument.ts

export interface AtsDocument {

  id: string;

  entityId: string;

  period: string;

  // Document identity
  documentType: string;        // 01 invoice, 04 credit note
  establishment?: string;
  emissionPoint?: string;
  sequential?: string;

  authorizationNumber?: string;

  date: string;

  // Parties
  ruc: string;
  razonSocial: string;

  // Monetary values
  base12: number;
  base0: number;
  iva: number;

  // Optional
  ice?: number;

  // Retentions
  retenciones?: Array<{
    taxType: "IVA" | "RENTA";
    code: string;
    percentage: number;
    base: number;
    amount: number;
  }>;

  // Traceability
  journalEntryIds: string[];

}