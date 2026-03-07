// ============================================================================
// src/types/ats.ts
// ATS normalized structures used before XML generation
// ============================================================================

export type AtsTransactionType =
  | "compra"
  | "venta"
  | "retencion"
  | "anulado";

export interface AtsRetention {

  impuesto: "IVA" | "RENTA";

  codigo: string;

  porcentaje: number;

  base: number;

  valor: number;

}

export interface AtsTransaction {

  period: string;

  type: AtsTransactionType;

  date: string;

  ruc: string;

  razonSocial: string;

  documentType: string;

  establishment?: string;

  emissionPoint?: string;

  sequential?: string;

  authorization?: string;

  baseNoGraIva: number;

  baseImponible: number;

  baseImpGrav: number;

  montoIva: number;

  formaPago?: string;

  retenciones?: AtsRetention[];

}

export interface AtsNormalizedData {

  compras: AtsTransaction[];

  ventas: AtsTransaction[];

  retenciones: AtsTransaction[];

  anulados: AtsTransaction[];

}