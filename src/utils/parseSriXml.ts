// ============================================================================
// src/utils/parseSriXml.ts
// CONTILISTO — Parse SRI authorized invoice XML (factura electrónica)
//
// Handles two formats the SRI delivers:
//   1. <autorizacion> wrapper with <comprobante><![CDATA[...]]></comprobante>
//   2. Bare <factura> document (no wrapper)
//
// Returns all fields needed to build journal entries via JournalPreviewModal.
// ============================================================================

import { invoiceNumberFromAccessKey } from "@/utils/sriInvoice";

// ---------------------------------------------------------------------------
// RESULT TYPE
// ---------------------------------------------------------------------------

export interface SriXmlInvoice {
  // SRI authorization
  accessKey: string;           // 49-digit clave de acceso
  invoice_number: string;      // 001-010-000000256 derived from access key
  authDate: string;            // YYYY-MM-DD

  // Issuer (the party that emitted the invoice)
  issuerRUC: string;
  issuerName: string;

  // Buyer
  buyerRUC: string;
  buyerName: string;

  // Date
  invoiceDate: string;         // YYYY-MM-DD

  // Tax amounts
  taxableBase: number;         // subtotal con IVA (SUBTOTAL 12% or 15%)
  taxable0: number;            // subtotal 0%
  taxRate: 12 | 15 | 0;
  iva: number;
  total: number;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function getText(doc: Document, tag: string): string {
  return doc.querySelector(tag)?.textContent?.trim() ?? "";
}

function parseNum(s: string): number {
  const n = Number(s.replace(/,/g, "."));
  return Number.isFinite(n) ? n : 0;
}

/** DD/MM/YYYY or DD/MM/YYYY HH:mm:ss → YYYY-MM-DD */
function toIso(raw: string): string {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return raw;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** codigoPorcentaje → IVA rate */
function codeToRate(code: string): 12 | 15 | 0 {
  if (code === "2") return 12;
  if (code === "4") return 15;
  return 0;
}

// ---------------------------------------------------------------------------
// MAIN PARSER
// ---------------------------------------------------------------------------

export function parseSriXml(xmlText: string): SriXmlInvoice {
  const parser = new DOMParser();

  // ── Step 1: parse outer document ──────────────────────────────────────────
  const outer = parser.parseFromString(xmlText, "text/xml");

  const parseError = outer.querySelector("parsererror");
  if (parseError) {
    throw new Error("El archivo XML no es válido: " + parseError.textContent?.slice(0, 120));
  }

  // ── Step 2: extract authorization wrapper fields ───────────────────────────
  let accessKey = getText(outer, "numeroAutorizacion").replace(/\s/g, "");
  const authDateRaw = getText(outer, "fechaAutorizacion");
  const authDate = authDateRaw ? toIso(authDateRaw) : "";

  // ── Step 3: get the inner <factura> doc ───────────────────────────────────
  // Could be inside <comprobante> CDATA, or the root element itself
  let factura: Document;

  const comprobante = outer.querySelector("comprobante");
  if (comprobante) {
    const inner = comprobante.textContent ?? "";
    factura = parser.parseFromString(inner.trim(), "text/xml");
    const innerError = factura.querySelector("parsererror");
    if (innerError) {
      throw new Error("El XML interno no es válido: " + innerError.textContent?.slice(0, 120));
    }
  } else {
    // Bare <factura> — the outer doc IS the invoice
    factura = outer;
  }

  // ── Step 4: infoTributaria ─────────────────────────────────────────────────
  const issuerRUC  = getText(factura, "infoTributaria ruc");
  const issuerName = getText(factura, "infoTributaria razonSocial");
  const estab      = getText(factura, "infoTributaria estab").padStart(3, "0");
  const ptoEmi     = getText(factura, "infoTributaria ptoEmi").padStart(3, "0");
  const secuencial = getText(factura, "infoTributaria secuencial").padStart(9, "0");

  // Prefer access key from <numeroAutorizacion>; fall back to <claveAcceso>
  if (!accessKey) {
    accessKey = getText(factura, "claveAcceso").replace(/\s/g, "");
  }

  // Derive human-readable invoice number
  const invoice_number = accessKey && /^\d{49}$/.test(accessKey)
    ? invoiceNumberFromAccessKey(accessKey)
    : `${estab}-${ptoEmi}-${secuencial}`;

  // ── Step 5: infoFactura ────────────────────────────────────────────────────
  const fechaRaw   = getText(factura, "infoFactura fechaEmision");
  const invoiceDate = toIso(fechaRaw);

  const buyerName  = getText(factura, "infoFactura razonSocialComprador");
  const buyerRUC   = getText(factura, "infoFactura identificacionComprador");

  const totalSinImpuestos = parseNum(getText(factura, "infoFactura totalSinImpuestos"));
  const importeTotal      = parseNum(getText(factura, "infoFactura importeTotal"));

  // ── Step 6: tax breakdown ──────────────────────────────────────────────────
  let taxableBase = 0;
  let taxable0    = 0;
  let iva         = 0;
  let taxRate: 12 | 15 | 0 = 0;

  const impuestos = factura.querySelectorAll("totalImpuesto");
  impuestos.forEach((imp) => {
    const codigo           = getText(imp as unknown as Document, "codigo");
    const codigoPorcentaje = getText(imp as unknown as Document, "codigoPorcentaje");
    const baseImponible    = parseNum(getText(imp as unknown as Document, "baseImponible"));
    const valor            = parseNum(getText(imp as unknown as Document, "valor"));

    if (codigo === "2") {
      // IVA
      const rate = codeToRate(codigoPorcentaje);
      if (rate > 0) {
        taxableBase += baseImponible;
        iva         += valor;
        if (!taxRate) taxRate = rate;
      } else {
        taxable0 += baseImponible;
      }
    }
    // codigo "3" = ICE — ignored for now
  });

  // Fallback: if no <totalImpuesto> found, use infoFactura totals
  if (taxableBase === 0 && taxable0 === 0) {
    taxableBase = totalSinImpuestos;
    iva = parseNum(getText(factura, "infoFactura totalConImpuestos valor"));
  }

  return {
    accessKey,
    invoice_number,
    authDate,
    issuerRUC,
    issuerName,
    buyerRUC,
    buyerName,
    invoiceDate,
    taxableBase,
    taxable0,
    taxRate,
    iva,
    total: importeTotal || Number((taxableBase + taxable0 + iva).toFixed(2)),
  };
}
