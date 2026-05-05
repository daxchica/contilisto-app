// ============================================================================
// src/services/parseSriTxt.ts
// Parses tab-delimited TXT files downloaded from the SRI portal (Recibidos).
// Expected columns (tab-separated):
//   RUC_EMISOR | RAZON_SOCIAL_EMISOR | TIPO_COMPROBANTE | SERIE_COMPROBANTE |
//   CLAVE_ACCESO | FECHA_AUTORIZACION | FECHA_EMISION | IDENTIFICACION_RECEPTOR |
//   VALOR_SIN_IMPUESTOS | IVA | IMPORTE_TOTAL | NUMERO_DOCUMENTO_MODIFICADO
// ============================================================================

export interface SriTxtRow {
  issuerRUC: string;
  issuerName: string;
  tipo: string;
  serie: string;
  claveAcceso: string;
  fechaEmision: string; // YYYY-MM-DD
  valorSinImpuestos: number;
  iva: number;
  ivaRate: number; // detected: 0, 12, or 15
  total: number;
}

// "01/12/2025" or "01/12/2025 14:43:57" → "2025-12-01"
function parseDateEC(raw: string): string {
  const datePart = raw.trim().split(" ")[0];
  const [dd, mm, yyyy] = datePart.split("/");
  if (!dd || !mm || !yyyy) return raw.trim();
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function parseNum(raw: string | undefined): number {
  if (!raw) return 0;
  return parseFloat(raw.trim().replace(",", ".")) || 0;
}

function detectIvaRate(base: number, iva: number): number {
  if (iva === 0 || base === 0) return 0;
  const pct = Math.round((iva / base) * 100);
  if (pct === 12 || pct === 15) return pct;
  // Fuzzy match for floating-point imprecision
  const ratio = iva / base;
  if (ratio > 0.135 && ratio < 0.165) return 15;
  if (ratio > 0.105 && ratio < 0.135) return 12;
  return 15; // default to current Ecuador standard rate
}

export function parseSriTxt(content: string): SriTxtRow[] {
  const lines = content.split(/\r?\n/);
  const rows: SriTxtRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split("\t");
    if (cols.length < 11) continue;

    const valorSinImpuestos = parseNum(cols[8]);
    const iva = parseNum(cols[9]);
    const total = parseNum(cols[10]);

    if (!total) continue; // skip empty/zero rows

    rows.push({
      issuerRUC: cols[0]?.trim() ?? "",
      issuerName: cols[1]?.trim() ?? "",
      tipo: cols[2]?.trim() ?? "",
      serie: cols[3]?.trim() ?? "",
      claveAcceso: cols[4]?.trim() ?? "",
      fechaEmision: parseDateEC(cols[6] ?? ""),
      valorSinImpuestos,
      iva,
      ivaRate: detectIvaRate(valorSinImpuestos, iva),
      total,
    });
  }

  return rows;
}
