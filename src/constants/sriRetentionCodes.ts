// ============================================================================
// src/constants/sriRetentionCodes.ts
// CONTILISTO — Catálogo oficial de códigos de retención SRI Ecuador
//
// Fuente: Resolución NAC-DGERCGC14-00787 + actualizaciones 2024
// Tabla de porcentajes de retención en la fuente del Impuesto a la Renta
// Tabla de retenciones del IVA
// ============================================================================

// ----------------------------------------------------------------------------
// IR (Impuesto a la Renta) — Retenciones en la fuente
// ----------------------------------------------------------------------------

export interface SriIRCode {
  code: string;
  label: string;
  description: string;
  /** Percentage(s) associated with this code (for default-selection hints) */
  percentages: number[];
}

export const SRI_IR_CODES: SriIRCode[] = [
  {
    code: "3493",
    label: "Retención mínima - PN",
    description: "Pagos a personas naturales no obligadas a llevar contabilidad (0.10%)",
    percentages: [0.10],
  },
  {
    code: "312",
    label: "Bienes muebles",
    description: "Transferencia de bienes muebles de naturaleza corporal (1%)",
    percentages: [1],
  },
  {
    code: "309",
    label: "Publicidad y comunicación",
    description: "Servicios de publicidad y comunicación - personas naturales (1%)",
    percentages: [1],
  },
  {
    code: "310",
    label: "Transporte",
    description: "Transporte privado de pasajeros o servicio público o privado de carga (1%)",
    percentages: [1],
  },
  {
    code: "340",
    label: "Arrendamiento mercantil (leasing)",
    description: "Pagos por arrendamiento mercantil (leasing) (1%)",
    percentages: [1],
  },
  {
    code: "325",
    label: "Seguros y reaseguros",
    description: "Seguros y reaseguros (cesión y retrocesión) (1.75%)",
    percentages: [1.75],
  },
  {
    code: "308",
    label: "Servicios entre sociedades",
    description: "Servicios prestados por sociedades (1.75%)",
    percentages: [1.75],
  },
  {
    code: "307",
    label: "Servicios - mano de obra (PN)",
    description: "Servicios donde predomina la mano de obra - personas naturales (2%)",
    percentages: [2],
  },
  {
    code: "327",
    label: "Otro tipo de renta (PN)",
    description: "Otro tipo de renta - personas naturales (2%)",
    percentages: [2],
  },
  {
    code: "332",
    label: "Bienes agrícolas / avícolas / pecuarios",
    description: "Bienes de origen agrícola, avícola, pecuario, apícola, cunícola y similares (2%)",
    percentages: [2],
  },
  {
    code: "334",
    label: "Otras compras / bienes",
    description: "Otras compras de bienes o servicios no especificados (2%)",
    percentages: [2],
  },
  {
    code: "304",
    label: "Servicios - intelecto sin título",
    description: "Servicios donde predomina el intelecto, sin título profesional (8%)",
    percentages: [8],
  },
  {
    code: "319",
    label: "Arrendamiento inmuebles",
    description: "Arrendamiento de bienes inmuebles (8%)",
    percentages: [8],
  },
  {
    code: "303",
    label: "Honorarios profesionales",
    description: "Honorarios, comisiones y dietas - profesionales con título universitario (10%)",
    percentages: [10],
  },
  {
    code: "320",
    label: "Loterías, rifas, apuestas",
    description: "Loterías, rifas, apuestas y similares (15%)",
    percentages: [15],
  },
  {
    code: "5002",
    label: "Otros (no listados)",
    description: "Otras retenciones no especificadas en los códigos anteriores",
    percentages: [],
  },
];

/** Quick lookup: given an IR percent, return the most common default code */
export function defaultIRCode(percent: number): string {
  switch (percent) {
    case 0.10: return "3493";
    case 1:    return "312";   // bienes muebles - most common for 1%
    case 1.75: return "325";   // seguros - common for 1.75%
    case 2:    return "307";   // servicios PN - most common for 2%
    case 3:    return "327";   // otro tipo
    case 5:    return "327";   // otro tipo
    case 8:    return "304";   // servicios intelecto
    case 10:   return "303";   // honorarios
    case 15:   return "320";   // loterías
    default:   return "5002";  // otros
  }
}

// ----------------------------------------------------------------------------
// IVA — Retenciones del IVA (2024 Ecuador)
// ----------------------------------------------------------------------------

export interface SriIVACode {
  code: string;
  label: string;
  description: string;
  /** Retention percentage of IVA (e.g. 30 = retain 30% of IVA charged) */
  percentages: number[];
}

export const SRI_IVA_CODES: SriIVACode[] = [
  {
    code: "1",
    label: "10% del IVA",
    description: "Retención del 10% del IVA — servicios de medios de comunicación (IVA 15%)",
    percentages: [10],
  },
  {
    code: "2",
    label: "20% del IVA",
    description: "Retención del 20% del IVA — bienes (IVA 15%)",
    percentages: [20],
  },
  {
    code: "3",
    label: "30% del IVA",
    description: "Retención del 30% del IVA — bienes y servicios en general",
    percentages: [30],
  },
  {
    code: "5",
    label: "50% del IVA",
    description: "Retención del 50% del IVA — servicios profesionales y arrendamiento de bienes inmuebles",
    percentages: [50],
  },
  {
    code: "7",
    label: "70% del IVA",
    description: "Retención del 70% del IVA — honorarios profesionales",
    percentages: [70],
  },
  {
    code: "10",
    label: "100% del IVA",
    description: "Retención del 100% del IVA — liquidaciones de compra y servicios sin factura",
    percentages: [100],
  },
];

/** Quick lookup: given an IVA retention percent, return the most common default code */
export function defaultIVACode(percent: number): string {
  switch (percent) {
    case 10:  return "1";
    case 20:  return "2";
    case 30:  return "3";
    case 50:  return "5";
    case 70:  return "7";
    case 100: return "10";
    default:  return "3";
  }
}
