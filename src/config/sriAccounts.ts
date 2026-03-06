// ============================================================================
// SRI ACCOUNT MAPPING
// Central tax mapping used by IVA, ATS and Retenciones
// ============================================================================

export const SRI_ACCOUNT_MAP = {

  IVA_VENTAS: [
    "201020101", // IVA Débito en ventas
  ],

  IVA_COMPRAS: [
    "133010102", // IVA crédito en compras 12%
  ],

  IVA_COMPRAS_0: [
    "1330102", // IVA 0%
  ],

  // Future ATS fields
  RETENCION_RENTA: [
    "201020201"
  ],

  RETENCION_IVA: [
    "201020202"
  ]

};