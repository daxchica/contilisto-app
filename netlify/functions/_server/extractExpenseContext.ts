// ============================================================================
// extractExpenseContext.ts
// PURPOSE:
// - Analyze invoice item detail (Cuadro 4)
// - Derive a clean accounting concept
// - Classify expense category (for account mapping / learning)
// ============================================================================

type TextItemLite = {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ExpenseContext = {
  concepto: string;
  category:
    | "combustible"
    | "alimentacion"
    | "seguros"
    | "vestuario"
    | "transporte"
    | "servicios"
    | "mantenimiento"
    | "suministros"
    | "otros";
};

// ---------------------------------------------------------------------------
// KEYWORD MAP (curated, conservative)
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<ExpenseContext["category"], string[]> = {
  combustible: [
    "DIESEL",
    "GASOLINA",
    "EXTRA",
    "SUPER",
    "COMBUSTIBLE",
    "GAS"
  ],
  alimentacion: [
    "ALIMENT",
    "COMIDA",
    "RESTAURANT",
    "DESAYUNO",
    "ALMUERZO",
    "CENA"
  ],
  seguros: [
    "SEGURO",
    "POLIZA",
    "PÓLIZA",
    "ASEGUR"
  ],
  vestuario: [
    "UNIFORME",
    "ROPA",
    "CAMISA",
    "CHAQUETA",
    "ZAPATO",
    "CALZADO"
  ],
  transporte: [
    "FLETE",
    "TRANSPORTE",
    "ENVIO",
    "ENVÍO",
    "MOVILIZACION"
  ],
  mantenimiento: [
    "MANTENIMIENTO",
    "REPARACION",
    "REPUESTO",
    "SERVICIO TECNICO"
  ],
  suministros: [
    "INSUMO",
    "SUMINISTRO",
    "MATERIAL",
    "PAPEL",
    "OFICINA"
  ],
  servicios: [
    "SERVICIO",
    "HONORARIO",
    "CONSULTORIA",
    "ARRENDAMIENTO",
    "ALQUILER"
  ],
  otros: [],
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return (s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isItemNoise(line: string): boolean {
  return (
    line.length < 5 ||
    /^\d+$/.test(line) ||
    line.includes("SUBTOTAL") ||
    line.includes("IVA") ||
    line.includes("TOTAL")
  );
}

// ---------------------------------------------------------------------------
// MAIN FUNCTION
// ---------------------------------------------------------------------------

export function extractExpenseContextFromItems(
  page1Items: TextItemLite[],
  ocrText: string
): ExpenseContext {
  // -------------------------------------------------------------------------
  // 1️⃣ Collect probable item descriptions (Cuadro 4)
  // -------------------------------------------------------------------------

  const candidates = page1Items
    .map(it => normalize(it.str))
    .filter(s => !isItemNoise(s))
    .filter(s => s.length >= 6);

  // Fallback to OCR text if layout is poor
  if (candidates.length === 0 && ocrText) {
    candidates.push(
      ...ocrText
        .split(/\n+/)
        .map(normalize)
        .filter(s => !isItemNoise(s))
        .filter(s => s.length >= 6)
    );
  }

  // -------------------------------------------------------------------------
  // 2️⃣ Detect category by keyword dominance
  // -------------------------------------------------------------------------

  let detectedCategory: ExpenseContext["category"] = "otros";
  let maxHits = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let hits = 0;
    for (const line of candidates) {
      for (const kw of keywords) {
        if (line.includes(kw)) hits++;
      }
    }
    if (hits > maxHits) {
      maxHits = hits;
      detectedCategory = category as ExpenseContext["category"];
    }
  }

  // -------------------------------------------------------------------------
  // 3️⃣ Build clean concept (human readable)
  // -------------------------------------------------------------------------

  const concepto =
    candidates.find(s => s.length <= 80) ||
    detectedCategory.charAt(0).toUpperCase() + detectedCategory.slice(1);

  return {
    concepto,
    category: detectedCategory,
  };
}