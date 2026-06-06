// ============================================================================
// src/utils/parseSriRetPdf.ts
// CONTILISTO — Parse SRI comprobante de retención from raw PDF text
//
// Ecuador SRI retention PDFs (RIDEs) have a consistent layout. This parser
// extracts the same structure as parseSriRetXml so downstream code is unified.
// ============================================================================

import type { SriRetXmlResult, SriRetTaxLine } from "@/utils/parseSriRetXml";

// ── helpers ──────────────────────────────────────────────────────────────────

/** True when the PDF text belongs to a retention certificate.
 *  Accepts both original-case and lowercase input. */
export function isRetentionPdf(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("comprobante de retenci") ||
    (lower.includes("retencion") && lower.includes("impuesto a la renta")) ||
    lower.includes("agente de retenci")
  );
}

function parseNum(s: string): number {
  const n = Number(s.replace(/,/g, ".").trim());
  return Number.isFinite(n) ? n : 0;
}

/** DD/MM/YYYY → YYYY-MM-DD */
function toIso(raw: string): string {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return raw.trim();
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function firstMatch(text: string, ...patterns: RegExp[]): string {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

// ── main parser ───────────────────────────────────────────────────────────────

/**
 * Parse a retention PDF RIDE into the same SriRetXmlResult shape used by the
 * XML parser.  Handles the Ecuador SRI standard RIDE layout.
 *
 * @param rawText  Full text extracted from the PDF (all pages concatenated)
 */
export function parseSriRetPdf(rawText: string): SriRetXmlResult {
  // Normalize input. The server-side Netlify OCR returns flat single-line text
  // (pdfjs items joined with spaces). The browser pdfjs may produce line-separated
  // text after our y-coordinate grouping.  Handle both by collapsing to single
  // space between tokens while preserving original casing for regex /i matching.
  const isFlat = !rawText.includes("\n") || rawText.split("\n").length < 5;

  const text = isFlat
    // Flat text: collapse all whitespace to single space
    ? rawText.replace(/\s+/g, " ").trim()
    // Line-separated text: normalize within each line
    : rawText
        .split("\n")
        .map((line) => line.replace(/[ \t]+/g, " ").trim())
        .filter(Boolean)
        .join("\n");

  // ── Authorization / cert number ──────────────────────────────────────────

  // Access key: 49 digits
  const accessKey = (text.match(/\b(\d{49})\b/) ?? [])[1] ?? "";

  // Cert number: NNN-NNN-NNNNNNNNN or similar
  const certNumberRaw = firstMatch(
    text,
    /No\.\s*(\d{3}[-–]\d{3}[-–]\d{9,})/i,
    /N[uú]mero[:\s]+(\d{3}[-–]\d{3}[-–]\d{9,})/i,
    /COMPROBANTE DE RETENCI[OÓ]N\s+No\.\s*(\d[\d\-]+)/i,
  );

  // From access key if available: positions 25-34 give estab-pto-seq
  let certNumber = certNumberRaw;
  if (!certNumber && accessKey.length === 49) {
    const estab = accessKey.slice(24, 27);
    const pto   = accessKey.slice(27, 30);
    const seq   = accessKey.slice(30, 39);
    certNumber  = `${estab}-${pto}-${seq}`;
  }

  // ── Dates ────────────────────────────────────────────────────────────────

  const issueDateRaw = firstMatch(
    text,
    /Fecha[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    /(\d{2}\/\d{2}\/\d{4})/,
  );
  const issueDate = issueDateRaw ? toIso(issueDateRaw) : "";
  const authDate  = issueDate; // RIDE doesn't always separate these

  // ── Parties ──────────────────────────────────────────────────────────────
  //
  // In the SRI RIDE layout (after proper line extraction) the structure is:
  //   Line 1: "R.U.C.: 0968595620001"           ← issuerRUC
  //   Line 2: "COMPROBANTE DE RETENCIÓN"
  //   Line 3: "No. 001-010-000018881"
  //   ...
  //   (company name appears before / right after the RUC line or near "ATM")
  //   ...
  //   "Razón Social / Nombres y Apellidos: BWEE ROBOTICS ECUADOR..."  ← subject name
  //   "Identificación 0993245364001"                                   ← subjectRUC

  // Issuer RUC — first 13-digit RUC in the document
  const issuerRUC = firstMatch(
    text,
    /R\.U\.C\.\s*[:\s]*(\d{13})/i,
    /RUC\s*:\s*(\d{13})/i,
  );

  // Issuer name — appears on the line(s) following the RUC header.
  // Strategy: take the line right after "R.U.C.: XXXXX" or look for
  // "EMPRESA PUBLICA" / well-known company name patterns.
  const lines = text.split("\n");
  let issuerName = "";
  for (let i = 0; i < lines.length; i++) {
    if (/R\.U\.C\./i.test(lines[i])) {
      // Company name is typically 2-3 lines down (after COMPROBANTE DE RETENCIÓN, No., NÚMERO DE AUTORIZACIÓN)
      // Look ahead for a non-trivial all-caps line that isn't a keyword
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const candidate = lines[j].trim();
        if (
          candidate.length > 5 &&
          !/^(COMPROBANTE|No\.|N[UÚ]MERO|AMBIENTE|EMISI[OÓ]N|DIRECCI[OÓ]N|CLAVE|CONTRIBUYENTE|\d)/.test(candidate) &&
          !/^\d{10,}/.test(candidate)
        ) {
          // Strip trailing date/keyword fragments that pdfjs merges from adjacent columns
          issuerName = candidate
            .replace(/\s+FECHA Y HORA DE\s*$/i, "")
            .replace(/\s+\d{2}\/\d{2}\/\d{4}.*$/i, "")
            .trim();
          break;
        }
      }
      break;
    }
  }

  // Fallback: first "EMPRESA …" or company-like line
  if (!issuerName) {
    issuerName = firstMatch(
      text,
      /^(EMPRESA[^\n]{3,80})$/im,
      /^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s\.,]{10,80}(?:S\.A\.|CIA\.|EP|LTDA\.?))$/im,
    );
  }

  // Subject (sujeto retenido — whose tax was withheld).
  // "Razón Social / Nombres y Apellidos: BWEE ROBOTICS..."
  // In flat text, stop at "Identificación" or "Fecha" keyword; in line text stop at \n.
  const subjectMatch = text.match(/Raz[oó]n Social[^:]*:\s*(.{3,120})/i);
  const supplierNameRaw = subjectMatch?.[1] ?? "";
  const supplierName = supplierNameRaw
    .split(/\s+(?:Identificaci[oó]n|Fecha)\b/i)[0]
    .replace(/\n.*/s, "")
    .trim()
    .slice(0, 80);

  // Subject RUC — "Identificación XXXXXXXXX" (appears after subject name)
  const subjectRUCMatch = text.match(/Identificaci[oó]n\s+(\d{10,13})/i);
  const supplierRUC = subjectRUCMatch?.[1]?.trim() ?? "";

  // ── Retention lines ──────────────────────────────────────────────────────
  //
  // RIDE table columns (approximate):
  //   Comprobante | Número | Fecha Emisión | Ejercicio Fiscal |
  //   Base Imponible para la Retención | Impuesto | Porcentaje Retención | Valor Retenido
  //
  // Example rows from extracted text:
  //   "FACTURA 27/04/2026 04/2026 7318.50 Impuesto a la Renta 2.0 146.37"
  //   "FACTURA 27/04/2026 04/2026 17131.50 Impuesto a la Renta 3.0 513.95"
  //   "FACTURA 27/04/2026 04/2026 3667.50 IVA 100.0 3667.50"

  const retentions: SriRetTaxLine[] = [];
  let totalRenta = 0;
  let totalIVA   = 0;

  // Ecuador SRI retention PDFs (RIDEs) show the invoice number in a table cell
  // that pdfjs splits across lines, e.g.:
  //   "0011000000000\nFACTURA 27/04/2026 ...\n55"
  //   first 13 chars + FACTURA row + last 2 digits = full 15-digit sequential
  //
  // Strategy 1: dashed format already in text  (001-100-000000055)
  // Strategy 2: full 15-digit run              (001100000000055)
  // Strategy 3: 13-digit prefix + any content + 1-3 digit suffix (RIDE split)

  const certDigits = certNumber.replace(/[-]/g, "");

  function formatInvoice(digits: string): string {
    // digits is always 15 chars
    return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  }

  let invoiceNumber = "";

  // Strategy 1: dashed format
  const dashedMatch = text.match(/\b(\d{3}-\d{3}-\d{9})\b/g) ?? [];
  for (const d of dashedMatch) {
    const digits = d.replace(/-/g, "");
    if (digits !== certDigits) { invoiceNumber = d; break; }
  }

  // Strategy 2: 15-digit run
  if (!invoiceNumber) {
    const runs = [...text.matchAll(/\b(\d{15})\b/g)];
    for (const m of runs) {
      if (m[1] !== certDigits) { invoiceNumber = formatInvoice(m[1]); break; }
    }
  }

  // Strategy 3a: RIDE split with newlines (browser pdfjs y-grouped)
  if (!invoiceNumber) {
    const splitRe = /(\d{13})\s*[\r\n]+\s*(?:FACTURA|LIQUIDACI[OÓ]N).*?[\r\n]+\s*(\d{1,3})\s*[\r\n]/gis;
    for (const m of text.matchAll(splitRe)) {
      const full = m[1] + m[2].padStart(2, "0");
      if (full.length === 15 && full !== certDigits) {
        invoiceNumber = formatInvoice(full);
        break;
      }
    }
  }

  // Strategy 3b: Flat text — 13-digit prefix before FACTURA, trailing 1-3 digits at end of row
  if (!invoiceNumber && isFlat) {
    const flatRe = /(\d{13})\s+(?:FACTURA|LIQUIDACI[OÓ]N)\s+[\d/].*?[\d,.]+\s+(\d{1,3})(?=\s+\d{13}\s+FACTURA|\s*$)/gi;
    for (const m of text.matchAll(flatRe)) {
      const full = m[1] + m[2].padStart(2, "0");
      if (full.length === 15 && full !== certDigits) {
        invoiceNumber = formatInvoice(full);
        break;
      }
    }
  }

  // Parse each retention line using the RIDE pattern
  // Pattern: (FACTURA|...) date period baseAmount (Impuesto a la Renta|IVA) percentage amount
  // Pattern covers:
  //  • Line-separated: "FACTURA 27/04/2026 04/2026 7318.50 Impuesto a la Renta 2.0 146.37"
  //  • Flat text:      "0011000000000 FACTURA 27/04/2026 04/2026 7318.50 Impuesto a la Renta 2.0 146.37 55"
  //  The leading invoice-number prefix (\d{13})? and trailing suffix \s+\d{1,3} are optional.
  const lineRe = /(?:\d{13}\s+)?(?:FACTURA|LIQUIDACI[OÓ]N|NOTA DE DEBITO)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{4})\s+([\d,.]+)\s+(Impuesto a la Renta|IVA)\s+([\d,.]+)\s+([\d,.]+)/gi;

  for (const m of text.matchAll(lineRe)) {
    const [, invDate, , baseStr, taxTypeRaw, pctStr, amtStr] = m;
    const isIVA = /iva/i.test(taxTypeRaw);
    const base  = parseNum(baseStr);
    const pct   = parseNum(pctStr);
    const amt   = parseNum(amtStr);

    // Derive a plausible retention code from percentage
    let retentionCode: string;
    if (isIVA) {
      // IVA codes: 1=10%, 2=20%, 3=30%, 5=50%, 7=70%, 10=100%
      retentionCode =
        pct === 10  ? "1"  :
        pct === 20  ? "2"  :
        pct === 30  ? "3"  :
        pct === 50  ? "5"  :
        pct === 70  ? "7"  :
        pct === 100 ? "10" : "10";
    } else {
      // Renta codes from percentage
      retentionCode =
        pct <= 0.1  ? "3493" :
        pct === 1   ? "312"  :
        pct === 1.75? "325"  :
        pct === 2   ? "307"  :
        pct === 3   ? "308"  :
        pct === 8   ? "304"  :
        pct === 10  ? "303"  :
        pct === 15  ? "320"  : "327";
    }

    retentions.push({
      taxCode:        isIVA ? "2" : "1",
      retentionCode,
      baseAmount:     base,
      percentage:     pct,
      retainedAmount: amt,
      docType:        "01",
      invoiceNumber,
      invoiceDate:    toIso(invDate),
    });

    if (isIVA) totalIVA   += amt;
    else        totalRenta += amt;
  }

  const totalRetained = +(totalRenta + totalIVA).toFixed(2);
  totalRenta = +totalRenta.toFixed(2);
  totalIVA   = +totalIVA.toFixed(2);

  return {
    accessKey,
    certNumber,
    authDate,
    issueDate,
    issuerRUC,
    issuerName,
    supplierRUC,
    supplierName,
    retentions,
    totalRenta,
    totalIVA,
    totalRetained,
  };
}
