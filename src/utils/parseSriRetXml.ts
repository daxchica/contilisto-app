// ============================================================================
// src/utils/parseSriRetXml.ts
// CONTILISTO — Parse SRI comprobante de retención XML
//
// Handles two formats:
//   1. <autorizacion> wrapper with <comprobante><![CDATA[...]]></comprobante>
//   2. Bare <comprobanteRetencion> document
//
// Returns structured data ready to save as a retention record and link to
// the corresponding payable.
// ============================================================================

import { invoiceNumberFromAccessKey } from "@/utils/sriInvoice";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface SriRetTaxLine {
  /** 1 = Renta, 2 = IVA, 6 = ISD */
  taxCode: string;
  /** e.g. "303", "312", "441" */
  retentionCode: string;
  baseAmount: number;
  percentage: number;
  retainedAmount: number;
  /** codDocSustento: "01" = Factura, etc. */
  docType: string;
  /** Invoice number this retention applies to, e.g. "001-001-000000001" */
  invoiceNumber: string;
  /** YYYY-MM-DD */
  invoiceDate: string;
}

export interface SriRetXmlResult {
  // Authorization
  accessKey: string;
  certNumber: string;      // e.g. "001-001-000000007"
  authDate: string;        // YYYY-MM-DD
  issueDate: string;       // YYYY-MM-DD

  // Issuer (the company that issued/generated the retention)
  issuerRUC: string;
  issuerName: string;

  // Subject (the supplier that was retained)
  supplierRUC: string;
  supplierName: string;

  // Tax lines — one per impuesto element
  retentions: SriRetTaxLine[];

  // Convenience totals
  totalRenta: number;
  totalIVA: number;
  totalRetained: number;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function getText(node: Element | Document, tag: string): string {
  return node.querySelector(tag)?.textContent?.trim() ?? "";
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

// ---------------------------------------------------------------------------
// MAIN PARSER
// ---------------------------------------------------------------------------

export function parseSriRetXml(xmlText: string): SriRetXmlResult {
  const parser = new DOMParser();

  // ── Step 1: parse outer document ─────────────────────────────────────────
  const outer = parser.parseFromString(xmlText, "text/xml");

  const parseError = outer.querySelector("parsererror");
  if (parseError) {
    throw new Error(
      "El XML no es válido: " + parseError.textContent?.slice(0, 120)
    );
  }

  // ── Step 2: extract authorization wrapper ────────────────────────────────
  let accessKey = getText(outer, "numeroAutorizacion").replace(/\s/g, "");
  const authDateRaw = getText(outer, "fechaAutorizacion");
  const authDate = authDateRaw ? toIso(authDateRaw) : "";

  // ── Step 3: get the inner <comprobanteRetencion> ─────────────────────────
  let doc: Document;

  const comprobante = outer.querySelector("comprobante");
  if (comprobante) {
    const inner = comprobante.textContent ?? "";
    doc = parser.parseFromString(inner.trim(), "text/xml");
    const innerError = doc.querySelector("parsererror");
    if (innerError) {
      throw new Error(
        "El XML interno no es válido: " + innerError.textContent?.slice(0, 120)
      );
    }
  } else {
    doc = outer;
  }

  // Verify this is actually a retention document
  const rootTag = doc.documentElement?.tagName ?? "";
  if (!rootTag.includes("comprobanteRetencion") && !rootTag.includes("Retencion")) {
    throw new Error(
      `Este XML no es un comprobante de retención (encontrado: <${rootTag}>)`
    );
  }

  // ── Step 4: infoTributaria ───────────────────────────────────────────────
  const issuerRUC  = getText(doc, "infoTributaria ruc");
  const issuerName = getText(doc, "infoTributaria razonSocial");
  const estab      = getText(doc, "infoTributaria estab").padStart(3, "0");
  const ptoEmi     = getText(doc, "infoTributaria ptoEmi").padStart(3, "0");
  const secuencial = getText(doc, "infoTributaria secuencial").padStart(9, "0");

  if (!accessKey) {
    accessKey = getText(doc, "claveAcceso").replace(/\s/g, "");
  }

  const certNumber =
    accessKey && /^\d{49}$/.test(accessKey)
      ? invoiceNumberFromAccessKey(accessKey)
      : `${estab}-${ptoEmi}-${secuencial}`;

  // ── Step 5: infoCompRetencion ────────────────────────────────────────────
  const issueDateRaw  = getText(doc, "infoCompRetencion fechaEmision");
  const issueDate     = toIso(issueDateRaw);
  const supplierName  = getText(doc, "infoCompRetencion razonSocialSujetoRetenido");
  const supplierRUC   = getText(doc, "infoCompRetencion identificacionSujetoRetenido");

  // ── Step 6: impuestos ────────────────────────────────────────────────────
  const retentions: SriRetTaxLine[] = [];
  let totalRenta = 0;
  let totalIVA   = 0;

  doc.querySelectorAll("impuesto").forEach((imp) => {
    const taxCode        = getText(imp as unknown as Document, "codigo");
    const retentionCode  = getText(imp as unknown as Document, "codigoRetencion");
    const baseAmount     = parseNum(getText(imp as unknown as Document, "baseImponible"));
    const percentage     = parseNum(getText(imp as unknown as Document, "porcentajeRetener"));
    const retainedAmount = parseNum(getText(imp as unknown as Document, "valorRetenido"));
    const docType        = getText(imp as unknown as Document, "codDocSustento");
    const invoiceNumber  = getText(imp as unknown as Document, "numDocSustento");
    const invoiceDateRaw = getText(imp as unknown as Document, "fechaEmisionDocSustento");
    const invoiceDate    = toIso(invoiceDateRaw);

    retentions.push({
      taxCode,
      retentionCode,
      baseAmount,
      percentage,
      retainedAmount,
      docType,
      invoiceNumber,
      invoiceDate,
    });

    if (taxCode === "1") totalRenta += retainedAmount;
    if (taxCode === "2") totalIVA   += retainedAmount;
  });

  const totalRetained = +(totalRenta + totalIVA).toFixed(2);

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
    totalRenta: +totalRenta.toFixed(2),
    totalIVA:   +totalIVA.toFixed(2),
    totalRetained,
  };
}

// ---------------------------------------------------------------------------
// DOCUMENT TYPE DETECTOR
// (use this before choosing between parseSriXml and parseSriRetXml)
// ---------------------------------------------------------------------------

export type SriXmlDocType = "factura" | "retencion" | "unknown";

export function detectSriXmlType(xmlText: string): SriXmlDocType {
  const parser = new DOMParser();
  const outer  = parser.parseFromString(xmlText, "text/xml");

  // Check CDATA inner content tag first
  const cdata = outer.querySelector("comprobante")?.textContent ?? "";
  const searchIn = cdata || xmlText;

  if (/<comprobanteRetencion[\s>]/i.test(searchIn)) return "retencion";
  if (/<factura[\s>]/i.test(searchIn))               return "factura";

  // Fall back to root element tag
  const root = outer.documentElement?.tagName ?? "";
  if (root.toLowerCase().includes("retencion")) return "retencion";
  if (root.toLowerCase().includes("factura"))   return "factura";

  return "unknown";
}
