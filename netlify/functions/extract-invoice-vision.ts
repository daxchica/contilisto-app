/**
 * ECUADOR SRI RULE:
 * The issuer RUC (top-right SRI block) decides invoice type.
 * If issuerRUC === entityRUC → SALE
 * Else → EXPENSE
 * Never guess this using buyer data or GPT.
 * 
 * SRI RULE (ECUADOR):
 * - There is ONLY ONE authorization code (49 digits).
 * - Access key = authorization code = clave de acceso.
 * - Invoice number MUST be derived from this code when available.
 * - OCR invoice numbers are validation-only.
 */
// ============================================================================
// CONTILISTO — netlify/functions/extract-invoice-vision.ts
// OCR + LAYOUT SAFE
// Balance is enforced in JournalPreviewModal (UI)
// FIX: IssuerName MUST be first line on LEFT margin in Cuadro 1 (issuer block)
// UPGRADE: Totals = (taxableWithVat + taxable0 + nonTaxable) + IVA + ICE
//          Safe detection for SUBTOTAL 0% (layout + OCR)
// ============================================================================

import { Handler } from "@netlify/functions";
import { randomUUID } from "crypto";

import { extractExpenseContextFromItems } from "./_server/extractExpenseContext";
import { invoiceNumberFromAccessKey } from "@/utils/sriInvoice";
import { getContextualAccountHintServer } from "./_server/getContextualAccountHintServer";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

type TextItemLite = {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

interface ParsedInternal {
  issuerRUC: string;
  issuerName: string;

  buyerName: string;
  buyerRUC: string;

  invoiceDate: string;
  invoice_number: string;
  concepto: string;

  taxableBase: number;
  taxRate: 12 | 15 | 0;
  subtotal0: number;
  nonTaxable: number,

  iva: number;
  ice: number;
  total: number;

  ocr_text: string;
  warnings?: string[];
}

type AccountingLine = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
};

type FunctionResponse = {
  success: boolean;
  invoiceType?: "sale" | "expense";
  
  __extraction?: {
    pageCount: number;
    source: "ocr" | "layout";
  }

  issuerRUC?: string;
  issuerName?: string;

  buyerName?: string;
  buyerRUC?: string;

  invoiceDate?: string;
  invoice_number?: string;
  invoice_number_normalized?: string;

  taxableBase?: number;
  taxRate?: 12 | 15 | 0;
  subtotal0?: number;
  nonTaxable?: number;

  iva?: number;
  ice?: number;
  total?: number;

  concepto?: string;
  ocr_text?: string;

  entries?: any[];
  warnings?: string[];
  balance?: any;
  error?: string;
};

// IMPORTANT: Keep these names stable. Internally we’ll use SRI 3-category model.
type Totals = {
  taxableWithVat: number; // 12% or 15% base
  taxable0: number;       // SUBTOTAL 0%
  nonTaxable: number;     // NO OBJETO / EXENTO
  taxRate: 12 | 15 | 0;
  iva: number;
  ice: number;
  total: number;
};

// ---------------------------------------------------------------------------
// PDF TEXT EXTRACTION (PDF.js - Netlify safe)
// ---------------------------------------------------------------------------

async function extractText(data: Uint8Array) {
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const path = await import("path");
  const { pathToFileURL } = await import("url");

  let standardFontDataUrl: string | undefined;
  try {
    const fontsPath = path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "standard_fonts"
    );
    standardFontDataUrl = pathToFileURL(fontsPath + path.sep).toString();
  } catch {}

  const doc = await pdfjsLib.getDocument({
    data,
    disableWorker: true,
    standardFontDataUrl,
    verbosity: 0,
  }).promise;

  let text = "";
  let page1Items: TextItemLite[] = [];
  let allPagesItems: TextItemLite[][] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    content.items.forEach((it: any) => {
      text += ` ${it.str || ""}`;
    });

    const pageItems = content.items
      .map((it: any) => {
        const tr = it.transform;
        return {
          str: String(it.str || "").trim(),
          x: Number(tr?.[4] ?? 0),
          y: Number(tr?.[5] ?? 0),
          w: Number(it.width ?? 0),
          h: Number(it.height ?? 0),
        };
      })
      .filter((i: any) => i.str);

    allPagesItems.push(pageItems);

    if (i === 1) page1Items = pageItems;
  }

  return {
    text: text.replace(/\s+/g, " ").trim(),
    page1Items,
    allPagesItems,
    pageCount: doc.numPages,
  };
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const cleanRuc = (v: string) => (v || "").replace(/\D/g, "");
const safeNumber = (n: any) => (Number.isFinite(+n) ? +n : 0);

/** Money parser */
function parseMoney(raw: string): number {
  if (!raw) return 0;
  // Remove extra spaces
  const v = raw.trim();
  // If both separators exist, assume "." thousands and "," decimals
  if (v.includes(".") && v.includes(",")) {
    return safeNumber(v.replace(/\./g, "").replace(",", "."));
  }

  // only comma → decimal
  if (v.includes(",")) {
    return safeNumber(v.replace(",", "."));
  }

  // only dot → assume decimal ONLY if 2 decimals
  if (/\.\d{2}$/.test(v)) {
    return safeNumber(v);
  }

  return safeNumber(v.replace(/\./g, "").replace(",", "."));
}

/** Normalize things like "T A L M A X S A" -> "TALMAX SA" */
function normalizeSpacedCaps(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";

  const parts = s.split(/\s+/).filter(Boolean);
  // If it's mostly 1-char tokens (typical PDF text extraction)
  const oneCharCount = parts.filter((p) => p.length === 1).length;

  if (parts.length >= 4 && oneCharCount / parts.length >= 0.75) {
    let joined = parts.join("");
    joined = joined.replace(/S\.?A\.?$/i, "SA"); // unify
    joined = joined.replace(/L\.?T\.?D\.?A\.?$/i, "LTDA");
    // Insert space before common legal suffixes
    joined = joined.replace(/(.+)(SA)$/i, "$1 SA");
    joined = joined.replace(/(.+)(LTDA)$/i, "$1 LTDA");
    joined = joined.replace(/(.+)(CIA)$/i, "$1 CIA");
    return joined.replace(/\s+/g, " ").trim();
  }

  return s.replace(/\s+/g, " ").trim();
}

function pageHasTotals(items: TextItemLite[]): boolean {
  const joined = items.map(i => i.str.toUpperCase()).join(" ");
  return (
    joined.includes("SUBTOTAL") ||
    joined.includes("IVA") ||
    joined.includes("VALOR TOTAL")
  );
}

function extractAccessKey(text: string, items: TextItemLite[]): string {
  // 1️⃣ Prefer layout (barcode block text)
  for (const i of items) {
    const s = i.str.replace(/\s+/g, "");
    if (/^\d{49}$/.test(s)) return s;
  }

  // 2️⃣ OCR fallback
  const m = (text || "").replace(/\s+/g, "").match(/\d{49}/);
  return m?.[0] ?? "";
}

// ---------------------------------------------------------------------------
// INVOICE TYPE
// ---------------------------------------------------------------------------

function determineInvoiceType(
  issuerRUC: string,
  entityRUC: string
): "sale" | "expense" {
  if (!issuerRUC || !entityRUC) return "expense";
  return cleanRuc(issuerRUC) === cleanRuc(entityRUC) ? "sale" : "expense";
}

// ---------------------------------------------------------------------------
// LAYOUT GROUPING (LINE BUILDER)
// PDF.js gives independent items; we group by "visual line" using Y tolerance.
// Note: PDF.js y grows upward, so higher y = higher on page.
// ---------------------------------------------------------------------------

type VisualLine = { y: number; x0: number; x1: number; text: string };

function buildLines(items: TextItemLite[], yTol = 4): VisualLine[] {
  if (!items?.length) return [];

  const sorted = [...items].sort((a, b) => {
    if (Math.abs(b.y - a.y) > yTol) return b.y - a.y; // top to bottom (higher y first)
    return a.x - b.x; // left to right
  });

  const lines: { y: number; parts: TextItemLite[] }[] = [];
  let current: { y: number; parts: TextItemLite[] } | null = null;

  for (const it of sorted) {
    if (!current) {
      current = { y: it.y, parts: [it] };
      continue;
    }

    if (Math.abs(current.y - it.y) <= yTol) {
      current.parts.push(it);
      // keep representative y stable (don’t average too aggressively)
      current.y = (current.y + it.y) / 2;
    } else {
      lines.push(current);
      current = { y: it.y, parts: [it] };
    }
  }
  if (current) lines.push(current);

  return lines
    .map((l) => {
      const parts = [...l.parts].sort((a, b) => a.x - b.x);
      const rawText = parts.map((p) => p.str).join(" ").replace(/\s+/g, " ").trim();
      const text = normalizeSpacedCaps(rawText);
      const x0 = Math.min(...parts.map((p) => p.x));
      const x1 = Math.max(...parts.map((p) => p.x + (p.w || 0)));
      return { y: l.y, x0, x1, text };
    })
    .sort((a, b) => b.y - a.y);
}

// ---------------------------------------------------------------------------
// ISSUER NAME (CUADRO 1 — REGLA DEFINITIVA)
// ✅ "Primera línea sobre el margen izquierdo del cuadro 1"
// We enforce: TOP region + LEFT band + first valid line.
// ---------------------------------------------------------------------------

function isIssuerJunk(line: string) {
  const u = line.toUpperCase();

  // Hard junk
  if (/^\d+$/.test(u)) return true;
  if (u.includes("CLAVE DE ACCESO")) return true;
  if (u.includes("NUMERO DE AUTORIZACION") || u.includes("NÚMERO DE AUTORIZACIÓN")) return true;
  if (u.includes("AUTORIZACION")) return true;
  if (u.includes("FACTURA")) return true;
  if (u.startsWith("RUC") || u.startsWith("R.U.C")) return true;
  if (u.includes("AMBIENTE") || u.includes("EMISION") || u.includes("EMISIÓN")) return true;
  if (u.includes("OBLIGADO") || u.includes("CONTABILIDAD")) return true;

  if (u.startsWith("FECHA") || u.includes("FECHA Y HORA")) return true;
  if (u.includes("AGENTE DE RETENCION") || u.includes("AGENTE DE RETENCIÓN")) return true;
  if (u.includes("RESOLUCION") || u.includes("RESOLUCIÓN")) return true;

  return false;
}


function extractIssuerNameFromLayout(page1Items: TextItemLite[]): string {
  if (!page1Items.length) return "";

  // 1️⃣ Construir líneas visuales reales
  const lines = buildLines(page1Items);

  const ys = page1Items.map(i => i.y);
  const xs = page1Items.map(i => i.x);

  const maxY = Math.max(...ys);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const minX = Math.min(...xs);

  // 2️⃣ Cuadro 1 = 45% superior
  const topLimit = maxY - (maxY - minY) * 0.45;

  // 3️⃣ Columna izquierda = 40% izquierda
  const leftLimit = minX + (maxX - minX) * 0.4;

  // 4️⃣ Candidatas: arriba + izquierda
  const candidates = lines.filter((l) => l.y >= topLimit && l.x0 <= leftLimit);

  if (process.env.NODE_ENV !== "production") {
    console.log("ISSUER CANDIDATES:", candidates.map((c) => c.text));
  }

  // 5️⃣ PRIMERA línea válida (arriba → abajo)
  
  for (const line of candidates) {
    const text = line.text.trim();
    if (!text) continue;
    if (isIssuerJunk(text)) continue;
    
    return text
      .replace(/\s+FECHA.*$/i, "")
      .replace(/\s+EMISI[ÓO]N.*$/i, "")
      .replace(/\s+HORA.*$/i, "")
      .trim();
  }

  return "";

}

function extractIssuerRUCFromText(text: string): string {
  const clean = (text || "").replace(/\s+/g, " ");

  const explicit =
    clean.match(/\bR\s*\.?\s*U\s*\.?\s*C\s*[:\-]?\s*(\d{13})\b/i)?.[1] ?? "";
  if (explicit) return explicit;

  const any13 = clean.slice(0, 600).match(/\b(\d{13})\b/)?.[1] ?? "";
  return any13;
}

// ---------------------------------------------------------------------------
// ISSUER NAME OCR FALLBACK
// Used if layout detection fails
// ---------------------------------------------------------------------------

function extractIssuerNameFromOCR(text: string): string {

  const clean = (text || "").replace(/\s+/g, " ").trim();

  const m =
    clean.match(
      /\b([A-ZÁÉÍÓÚÑ0-9\s\.\-&]{5,80})\s+RUC\s*[:\-]?\s*\d{13}\b/i
    );

  if (m?.[1]) {
    return m[1]
      .replace(/\s+/g, " ")
      .trim();
  }

  return "";
}

// ---------------------------------------------------------------------------
// BUYER (kept, but not used to determine invoice type)
// ---------------------------------------------------------------------------

function extractBuyerFromLayout(page1Items: TextItemLite[]) {
  const lines = buildLines(page1Items);

  let buyerName = "";
  let buyerRUC = "";

  const anchorRe = /RAZ[ÓO]N\s+SOCIAL\s*\/\s*NOMBRES?\s+Y\s+APELLIDOS/i;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].text.trim();
    if (!raw) continue;
    if (!anchorRe.test(raw)) continue;

    buyerName = raw
      .replace(anchorRe, "")
      .replace(/^[:\-\s]+/, "")
      .replace(/\s+RUC\s*\/\s*CI\s*[:\-]?\s*\d{10,13}.*$/i, "")
      .trim();

    const lookahead = lines.slice(i, i + 4).map((l) => l.text).join(" ");
    const rucMatch =
      lookahead.match(/\bRUC\s*\/\s*CI\s*[:\-]?\s*(\d{10,13})\b/i) ||
      lookahead.match(/\b(\d{13})\b/);

    buyerRUC = cleanRuc(rucMatch?.[1] ?? "");

    if (buyerName && buyerName.toUpperCase() !== "FACTURA") {
      return { buyerName, buyerRUC };
    }

    buyerName = "";
    buyerRUC = "";
  }

  return { buyerName: "", buyerRUC: "" };
}

function extractBuyerFromOCR(text: string) {
  const t = (text || "").toUpperCase();
  const name =
    t.match(/RAZON SOCIAL\s*\/\s*NOMBRES Y APELLIDOS\s*[:\-]?\s*(.+?)\s*RUC/)?.[1] ??
    "";
  const ruc =
    t.match(/RUC\s*\/\s*CI\s*[:\-]?\s*(\d{10,13})/)?.[1] ?? "";
  return { buyerName: name.trim(), buyerRUC: cleanRuc(ruc) };
}

// ---------------------------------------------------------------------------
// INVOICE NUMBER & DATE (LAYOUT + OCR)
// ---------------------------------------------------------------------------

function extractInvoiceDate(text: string, items: TextItemLite[]): string {
  const dateRe =
    /\b\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}:\d{2})?\b/;

  // 1️⃣ Prefer layout
  const fromLayout = items.find((i) => dateRe.test(i.str));
  if (fromLayout) return fromLayout.str.trim().slice(0, 10);

  // 2️⃣ OCR fallback
  const m = (text || "").match(dateRe);
  return (m?.[0] ?? "").slice(0, 10);
}

// ---------------------------------------------------------------------------
// TOTALS DETECTION (LAYOUT + OCR) — ECUADOR SRI 3-CATEGORY MODEL
// ---------------------------------------------------------------------------

// Matches: 200.00  1200.00  1,200.00  1.200,00  12345.67
// [0-9]+ instead of [0-9]{1,3} so 4-digit+ amounts without separators are captured
const MONEY_GLOBAL = /([0-9]+(?:[.,][0-9]{3})*[.,][0-9]{2})/g;

function emptyTotals(): Totals {
  return {
    taxableWithVat: 0,
    taxable0: 0,
    nonTaxable: 0,
    taxRate: 0,
    iva: 0,
    ice: 0,
    total: 0,
  };
}

function computeExpectedTotal(t: Totals) {
  return Number((t.taxableWithVat + t.taxable0 + t.nonTaxable + t.iva + t.ice).toFixed(2));
}

function inferTaxRateFromBaseAndIva(base: number, iva: number): 12 | 15 | 0 {
  if (base <= 0 || iva <= 0) return 0;
  const r = (iva / base) * 100;
  if (Math.abs(r - 15) <= 1) return 15;
  if (Math.abs(r - 12) <= 1) return 12;
  return 0;
}

/** Merge digit-space-digit fragments that PDF.js splits across items.
 *  "1 200.00" → "1200.00", "1 380.00" → "1380.00"
 *  Applied repeatedly until no more merges are possible. */
function mergeDigitSpaces(s: string): string {
  let prev = "";
  let cur = s;
  while (cur !== prev) {
    prev = cur;
    cur = cur.replace(/(\d)\s+(\d)/g, "$1$2");
  }
  return cur;
}

function pickRightmostMoney(lineText: string): number {
  const s = mergeDigitSpaces(String(lineText || ""));
  const matches = [...s.matchAll(MONEY_GLOBAL)].map((m) => m[1]).filter(Boolean);
  if (!matches.length) return 0;
  return parseMoney(matches[matches.length - 1]); // RIGHTMOST
}

// ✅ SINGLE PAGE: layout-first totals using lines (preferred)
function detectTotalsFromLayout(items: TextItemLite[]): Totals {
  const res = emptyTotals();
  if (!items.length) return res;

  const lines = buildLines(items);

  for (const line of lines) {
    const raw = line.text || "";
    const u = raw.toUpperCase().replace(/\s+/g, "").trim();

    // 🚫 NEVER USE DERIVED FIELDS
    if (
      u.includes("SUBTOTAL SIN IMPUESTOS") ||
      u.includes("TOTAL DESCUENTO") ||
      u.includes("IRBPNR") ||
      u.includes("PROPINA") ||
      u.includes("VALOR TOTAL SIN SUBSIDIO") ||
      u.includes("AHORRO POR SUBSIDIO")
    ) {
      continue;
    }

    // -----------------------------
    // TAXABLE WITH IVA (12% or 15%)
    // -----------------------------
    if (/SUBTOTAL\s*15\s*%?/.test(u)) {
      const v = pickRightmostMoney(raw);
      if (v > 0) {
        res.taxableWithVat = v;
        res.taxRate = 15;
      }
      continue;
    }

    if (/SUBTOTAL\s*12\s*%?/.test(u)) {
      const v = pickRightmostMoney(raw);
      if (v > 0) {
        res.taxableWithVat = v;
        res.taxRate = 12;
      }
      continue;
    }

    // -----------------------------
    // TAXABLE SUBTOTAL 0%
    // -----------------------------
    if (/SUBTOTAL\s*0\s*%?/.test(u)) {
      const v = pickRightmostMoney(raw);
      if (v > 0) res.taxable0 = v;
      continue;
    }

    // NON TAXABLE (No objeto / Exento)
    if (/SUBTOTAL\s+NO\s+OBJETO\s+DE\s+IVA/.test(u) || /SUBTOTAL\s+EXENTO\s+DE\s+IVA/.test(u)) {
      const v = pickRightmostMoney(raw);
      if (v > 0) res.nonTaxable += v; // may appear twice: NO OBJETO + EXENTO
      continue;
    }
    if (/NO\s*OBJETO\s*DE\s*IVA|EXENTO\s*DE\s*IVA/.test(u)) {
      const v = pickRightmostMoney(raw);
      if (v > 0) res.nonTaxable = v; // fallback if not using SUBTOTAL form
      continue;
    }

    // IVA (read only; compute later ONLY if missing)
    if (/^IVA\s*(12|15)\s*%?/.test(u)) {
      const v = pickRightmostMoney(raw);
      if (v > 0) res.iva = v;
      continue;
    }

    // ICE (ONLY if explicitly present)
    if (/^ICE\b/.test(u)) {
      const v = pickRightmostMoney(raw);
      if (v > 0) res.ice = v;
      continue;
    }

    // TOTAL
    if (/^VALOR\s*TOTAL\b/.test(u) || /^TOTAL\s*A\s*PAGAR\b/.test(u)) {
      const v = pickRightmostMoney(raw);
      if (v > 0) res.total = v;
      continue;
    }
  }

  return res;
}

// ✅ MULTIPAGE or fallback: OCR totals from full text
function detectTotalsFromOCR(text: string): Totals {
  const res = emptyTotals();
  // Merge "1 200.00" → "1200.00" before regex matching
  const t = mergeDigitSpaces((text || "").replace(/\s+/g, " ")).toUpperCase();

  const pick = (re: RegExp) => {
    const m = t.match(re);
    return parseMoney(m?.[1] ?? "");
  };

  // Priority: explicit subtotals by rate
  const subtotal15 = pick(/SUBTOTAL\s*15\s*%?[\s\S]{0,40}?([0-9]+(?:[.,][0-9]{3})*[.,][0-9]{2})/);

  const subtotal12 =
    pick(/SUBTOTAL\s*12\s*%?[\s\S]{0,40}?([0-9]+(?:[.,][0-9]{3})*[.,][0-9]{2})/);

  // ✅ SAFE SUBTOTAL 0%
  const subtotal0 =
    pick(/SUBTOTAL\s*0\s*%?[\s\S]{0,40}?([0-9]+(?:[.,][0-9]{3})*[.,][0-9]{2})/) || 0;

  // Non-taxable: both NO OBJETO and EXENTO may exist
  const noObjeto =
    pick(/SUBTOTAL\s+NO\s+OBJETO\s+DE\s+IVA[\s\S]{0,40}?([0-9]+(?:[.,][0-9]{3})*[.,][0-9]{2})/) || 0;
  const exento =
    pick(/SUBTOTAL\s+EXENTO\s+DE\s+IVA[\s\S]{0,40}?([0-9]+(?:[.,][0-9]{3})*[.,][0-9]{2})/) || 0;

  // IVA
  const iva =
    pick(/IVA\s*(?:12|15)\s*%?[\s\S]{0,30}?([0-9]+(?:[.,][0-9]{3})*[.,][0-9]{2})/) || 0;

  // ICE (rare)
  const ice =
    pick(/\bICE\b[\s\S]{0,30}?([0-9]+(?:[.,][0-9]{3})*[.,][0-9]{2})/) || 0;

  // Total: prefer "VALOR TOTAL"
  const total =
    pick(/VALOR\s*TOTAL[\s\S]{0,30}?([0-9]+(?:[.,][0-9]{3})*[.,][0-9]{2})/) ||
    pick(/TOTAL\s*A\s*PAGAR[\s\S]{0,30}?([0-9]+(?:[.,][0-9]{3})*[.,][0-9]{2})/) ||
    0;

  // Set taxableWithVat & rate
  if (subtotal15 > 0) {
    res.taxableWithVat = subtotal15;
    res.taxRate = 15;
  } else if (subtotal12 > 0) {
    res.taxableWithVat = subtotal12;
    res.taxRate = 12;
  }

  res.taxable0 = subtotal0;
  res.nonTaxable = Number((noObjeto + exento).toFixed(2));
  res.iva = iva;

  // ICE: keep only explicit OCR detection (still never infer)
  res.ice = ice;

  // total from OCR (we still normalize later)
  res.total = total;

  // Infer rate if missing but base+iva exist
  if (!res.taxRate && res.taxableWithVat > 0 && res.iva > 0) {
    res.taxRate = inferTaxRateFromBaseAndIva(res.taxableWithVat, res.iva);
  }

  return res;
}

function normalizeSriTotals(t: Totals, warnings: string[]) {
  // ICE is never inferred
  if (!Number.isFinite(t.ice)) t.ice = 0;
  if (t.ice < 0) t.ice = 0;

  // Infer taxRate ONLY if missing but base+iva exist
  if (!t.taxRate && t.taxableWithVat > 0 && t.iva > 0) {
    const inferred = inferTaxRateFromBaseAndIva(t.taxableWithVat, t.iva);
    if (inferred) {
      t.taxRate = inferred;
      warnings.push("Tax rate inferred from IVA/base.");
    }
  }

  // IVA may be computed ONLY if missing and base+rate exist
  if (t.taxableWithVat > 0 && t.taxRate > 0 && (!t.iva || t.iva === 0)) {
    const expectedIva = Number((t.taxableWithVat * t.taxRate / 100).toFixed(2));
    if (expectedIva >= 0.01) {
      t.iva = expectedIva;
      warnings.push("IVA not detected; auto-calculated from taxable base and rate.");
    }
  }

  // FINAL total is ALWAYS the invariant sum
  const computedTotal = computeExpectedTotal(t);

  if (t.total > 0 && Math.abs(t.total - computedTotal) > 0.05) {
    warnings.push("Total adjusted to match SRI invariant (bases + IVA + ICE).");
  }

  t.total = computedTotal;

  return t;
}

// ---------------------------------------------------------------------------
// ACCOUNT MAP (CENTRALIZED)
// ---------------------------------------------------------------------------

type AccountMap = {
  sale: {
    ar: string;
    revenue: string;
    iva: string;
  };
  expense: {
    expenseDefault: string;
    iva: string;
    ap: string;
  };
};

const ACCOUNT_MAP: AccountMap = {
  sale: {
    ar: "101030101",
    revenue: "401020101",
    iva: "201020101",
  },
  expense: {
    expenseDefault: "502020101",
    iva: "1330101",
    ap: "201030102",
  },
};

// ---------------------------------------------------------------------------
// ACCOUNTING (NO CAMBIOS) — includes AP line for expenses always
// ---------------------------------------------------------------------------

async function buildAccounting(
  
  entry: ParsedInternal, 
  uid: string, invoiceType: "sale" | "expense"
) {
  console.log("VISION FUNCTION VERSION 2026-02-23");
  console.log("INVOICE TYPE:", invoiceType);
  const lines: AccountingLine[] = [];
  const warnings: string[] = [];

  // ================================
  // SALE
  // ================================
  if (invoiceType === "sale") {
    // AR
    lines.push({
      accountCode: ACCOUNT_MAP.sale.ar,
      accountName: "Clientes nacionales",
      debit: safeNumber(entry.total),
      credit: 0,
    });

    // Revenue (taxable + 0% + nonTaxable)
    lines.push({
      accountCode: ACCOUNT_MAP.sale.revenue,
      accountName: "Ingresos por servicios",
      debit: 0,
      credit: safeNumber(
        entry.total - entry.iva - entry.ice
      ),
    });

    // IVA Débito
    if (entry.iva > 0) {
      lines.push({
        accountCode: ACCOUNT_MAP.sale.iva,
        accountName: "IVA débito en ventas",
        debit: 0,
        credit: safeNumber(entry.iva),
      });
    }

    return { lines, warnings };
  }

  // ================================
  // EXPENSE
  // ================================

  let expenseCode = ACCOUNT_MAP.expense.expenseDefault;
  let expenseName = "Gastos operacionales";

  if (uid && entry.issuerRUC && entry.concepto) {
    try {
      const hint = await getContextualAccountHintServer(
        uid,
        entry.issuerRUC,
        entry.concepto
      );

      if (hint?.accountCode) {
        expenseCode = hint.accountCode;
        expenseName = hint.accountName;
      }
    } catch (err) {
      console.warn("Account hint lookup failed:", err);
    }
  }

  // Expense base without IVA/ICE, but include 0% and nonTaxable inside expense
  // Total = (base categories) + IVA + ICE => expense base = total - iva - ice
  lines.push({
    accountCode: expenseCode,
    accountName: expenseName,
    debit: safeNumber(entry.total - entry.iva - entry.ice),
    credit: 0,
  });

  if (entry.iva > 0) {
    lines.push({
      accountCode: ACCOUNT_MAP.expense.iva,
      accountName: "IVA crédito en compras",
      debit: safeNumber(entry.iva),
      credit: 0,
    });
  }

  // Always AP line (proveedor) for expenses
  lines.push({
    accountCode: ACCOUNT_MAP.expense.ap,
    accountName: "Proveedores locales",
    debit: 0,
    credit: safeNumber(entry.total),
  });

  return { lines, warnings };
}

// ---------------------------------------------------------------------------
// RETENTION PARSER (server-side, called before invoice logic)
// ---------------------------------------------------------------------------

interface RetentionLine {
  taxCode:        string;   // "1" = IR, "2" = IVA
  retentionCode:  string;   // SRI código de retención
  baseAmount:     number;
  percentage:     number;
  retainedAmount: number;
  invoiceNumber:  string;
  invoiceDate:    string;
}

interface RetentionParseResult {
  certNumber:    string;
  issueDate:     string;
  authDate:      string;
  issuerRUC:     string;
  issuerName:    string;
  supplierRUC:   string;
  supplierName:  string;
  retentions:    RetentionLine[];
  totalRenta:    number;
  totalIVA:      number;
  totalRetained: number;
}

function dd_mm_yyyy_to_iso(raw: string): string {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : raw.trim();
}

function parseRetentionFromText(
  flat: string,
  items: TextItemLite[]
): RetentionParseResult | null {

  // Build line-separated text using the same y-coordinate grouper the rest of
  // the function uses.  This is far more reliable than the raw flat string for
  // matching multi-token patterns across table cells.
  const visualLines = buildLines(items);
  const lineText = visualLines.map(l => l.text).join("\n");

  // For parsing we try lineText first; fall back to flat for anything not matched.
  console.log("[RET] lineText (first 600):", lineText.slice(0, 600));
  console.log("[RET] flat (first 400):",     flat.slice(0, 400));

  // ── Access key / cert number ─────────────────────────────────────────────
  const akMatch = flat.replace(/\s+/g, "").match(/\d{49}/);
  const accessKey = akMatch?.[0] ?? "";
  let certNumber = "";
  if (accessKey.length === 49) {
    certNumber = `${accessKey.slice(24, 27)}-${accessKey.slice(27, 30)}-${accessKey.slice(30, 39)}`;
  } else {
    const cnm = (lineText + "\n" + flat).match(/No\.\s*(\d{3}[-–]\d{3}[-–]\d{9})/i);
    certNumber = cnm?.[1] ?? "";
  }

  // ── Dates ────────────────────────────────────────────────────────────────
  const dateMatch = (lineText + "\n" + flat).match(/Fecha\s+(\d{2}\/\d{2}\/\d{4})/i);
  const issueDate = dateMatch ? dd_mm_yyyy_to_iso(dateMatch[1]) : "";
  const authDate  = issueDate;

  // ── Parties ──────────────────────────────────────────────────────────────
  const rucMatch  = (lineText + "\n" + flat).match(/R\.U\.C\.?\s*[:\s]*(\d{13})/i);
  const issuerRUC = rucMatch?.[1] ?? "";

  // Issuer name — first meaningful line in visual output
  let issuerName = "";
  for (const l of visualLines) {
    if (/R\.U\.C/i.test(l.text)) continue;
    if (l.text.length > 5 &&
        !/^(COMPROBANTE|No\.|NÚMERO|AMBIENTE|EMISIÓN|CLAVE|CONTRIBUYENTE|\d)/i.test(l.text) &&
        !/^\d{10,}/.test(l.text)) {
      issuerName = l.text.replace(/\s+FECHA Y HORA DE\s*$/i, "").trim();
      break;
    }
  }

  const combined = lineText + "\n" + flat;
  const subjMatch = combined.match(/Raz[oó]n Social[^:]*:\s*(.{3,120})/i);
  const supplierName = (subjMatch?.[1] ?? "")
    .split(/\s+(?:Identificaci[oó]n|Fecha)\b/i)[0]
    .replace(/\n.*/s, "")
    .trim()
    .slice(0, 80);

  const idMatch    = combined.match(/Identificaci[oó]n\s+(\d{10,13})/i);
  const supplierRUC = idMatch?.[1] ?? "";

  // ── Retention lines ──────────────────────────────────────────────────────
  // The RIDE table has rows like:
  //   "0011000000000"         ← invoice number prefix (its own visual line)
  //   "FACTURA  27/04/2026  04/2026  7318.50  Impuesto a la Renta  2.0  146.37"
  //   "55"                    ← invoice number suffix
  //
  // OR in flat text:
  //   "0011000000000 FACTURA 27/04/2026 04/2026 7318.50 Impuesto a la Renta 2.0 146.37 55"
  //
  // We try both the structured lineText (best) and flat fallback.

  const certDigits = certNumber.replace(/[-]/g, "");

  // Build a search corpus: use lineText joined with spaces when each "line"
  // is very short (table cells on own lines), else use the regular lineText.
  const avgLen = visualLines.length
    ? visualLines.reduce((s, l) => s + l.text.length, 0) / visualLines.length
    : 0;

  // If average visual line is short (<20 chars), table cells are on own lines:
  // join FACTURA row with its neighbours to reconstruct full row.
  let corpus: string;
  if (avgLen < 25) {
    // Sliding window: join groups of 3-4 consecutive lines to capture full row
    corpus = "";
    const lt = visualLines.map(l => l.text);
    for (let i = 0; i < lt.length; i++) {
      corpus += lt.slice(i, i + 6).join(" ") + "\n";
    }
  } else {
    corpus = lineText + "\n" + flat;
  }

  console.log("[RET] corpus (first 600):", corpus.slice(0, 600));

  const lineRe = /(?:(\d{13})\s+)?(?:FACTURA|LIQUIDACI[OÓ]N)\s+(\d{2}\/\d{2}\/\d{4})\s+(?:\d{2}\/\d{4})\s+([\d,.]+)\s+(Impuesto\s+a\s+la\s+Renta|IVA)\s+([\d,.]+)\s+([\d,.]+)/gi;

  const retentions: RetentionLine[] = [];
  let totalRenta = 0;
  let totalIVA   = 0;

  // Collect 13-digit invoice prefix candidates (appear before FACTURA in corpus)
  const invoiceDigits =
    [...corpus.matchAll(/(\d{13})\s+(?:FACTURA)/gi)].map(m => m[1])[0] ?? "";

  for (const m of corpus.matchAll(lineRe)) {
    const [fullMatch, invPrefix, invDate, baseStr, taxTypeRaw, pctStr, amtStr] = m;
    const isIVA = /iva/i.test(taxTypeRaw);
    const base  = safeNumber(baseStr.replace(",", "."));
    const pct   = safeNumber(pctStr.replace(",", "."));
    const amt   = safeNumber(amtStr.replace(",", "."));

    if (base <= 0 || amt <= 0) continue; // skip zero rows

    // Invoice number reconstruction
    let invoiceNumber = "";
    const prefix13 = invPrefix ?? invoiceDigits;
    if (prefix13?.length === 13) {
      const afterMatch = corpus.slice(m.index! + fullMatch.length).match(/^\s*(\d{1,3})\b/);
      if (afterMatch) {
        const full = prefix13 + afterMatch[1].padStart(2, "0");
        if (full.length === 15 && full !== certDigits) {
          invoiceNumber = `${full.slice(0,3)}-${full.slice(3,6)}-${full.slice(6)}`;
        }
      }
    }

    let retentionCode: string;
    if (isIVA) {
      retentionCode = pct === 10 ? "1" : pct === 20 ? "2" : pct === 30 ? "3" :
                      pct === 50 ? "5" : pct === 70 ? "7" : "10";
    } else {
      retentionCode = pct <= 0.1 ? "3493" : pct === 1   ? "312" :
                      pct === 1.75? "325" : pct === 2   ? "307" :
                      pct === 3  ? "308"  : pct === 8   ? "304" :
                      pct === 10 ? "303"  : "327";
    }

    retentions.push({
      taxCode:       isIVA ? "2" : "1",
      retentionCode,
      baseAmount:    base,
      percentage:    pct,
      retainedAmount: amt,
      invoiceNumber,
      invoiceDate:   dd_mm_yyyy_to_iso(invDate),
    });

    if (isIVA) totalIVA   += amt;
    else       totalRenta += amt;
  }

  console.log("[RET] retentions found:", retentions.length, JSON.stringify(retentions));

  if (!retentions.length) return null;

  return {
    certNumber,
    issueDate,
    authDate,
    issuerRUC,
    issuerName,
    supplierRUC,
    supplierName,
    retentions,
    totalRenta:    +totalRenta.toFixed(2),
    totalIVA:      +totalIVA.toFixed(2),
    totalRetained: +(totalRenta + totalIVA).toFixed(2),
  };
}

// ---------------------------------------------------------------------------
// HANDLER
// ---------------------------------------------------------------------------

export const handler: Handler = async (event) => {
  
  try {
    const { base64, userRUC, uid } = JSON.parse(event.body || "{}");
    
    if (!base64 || !userRUC) {
      
      return { statusCode: 400, body: "Missing base64 or userRUC" };
    }

    const buffer = new Uint8Array(Buffer.from(base64, "base64"));
    const { text, page1Items, allPagesItems, pageCount } =
      await extractText(buffer);

    // ── RETENTION DETECTION ─────────────────────────────────────────────────
    // If the document is a "Comprobante de Retención", parse it here and return
    // structured retention data so the frontend can route to JournalPreviewModal
    // with the correct accounts — without going through the invoice-type logic.
    if (/COMPROBANTE\s+DE\s+RETENCI[OÓ]N/i.test(text)) {
      const retResult = parseRetentionFromText(text, page1Items);
      if (retResult) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            success:     true,
            isRetention: true,
            ocr_text:    text,
            ...retResult,
          }),
        };
      }
    }
    // ── END RETENTION DETECTION ─────────────────────────────────────────────

    const parseWarnings: string[] = [];

    const accessKey = extractAccessKey(text, page1Items);

    const invoice_number = 
      accessKey
        ? invoiceNumberFromAccessKey(accessKey)
        : "";

    if (!accessKey) {
      parseWarnings.push(    
        "Access key (49 digits) not detected; invoice number cannot be derived from SRI key."
      );
      
    }
    
    // ------------------------------------------------------------------
    // ISSUER
    // ------------------------------------------------------------------
    
    // 1️⃣ Try layout detection first
    let issuerName = extractIssuerNameFromLayout(page1Items);

    // 2️⃣ Fallback to OCR detection
    if (!issuerName) {
      issuerName = extractIssuerNameFromOCR(text);
    }

    // Issuer RUC: from OCR text
    const issuerRUC = extractIssuerRUCFromText(text);

    // 3️⃣ Final fallback
    if (!issuerName && issuerRUC) {
      issuerName = `PROVEEDOR ${issuerRUC}`;
    }

    if (!issuerRUC) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          error: "Could not detect issuer RUC.",
          ocr_text: text,
        } satisfies FunctionResponse),
      };
    }

    const invoiceType = determineInvoiceType(issuerRUC, userRUC);

    // ------------------------------------------------------------------
    // BUYER (ONLY FOR SALES)
    // ------------------------------------------------------------------
    let buyerName = "";
    let buyerRUC = "";

    // Only SALES need buyer from Cuadro 3
    if (invoiceType === "sale") {
      const fromLayout = extractBuyerFromLayout(page1Items);
      buyerName = fromLayout.buyerName;
      buyerRUC = fromLayout.buyerRUC;

      if (!buyerName || buyerName.toUpperCase() === "FACTURA") {
        const fromOCR = extractBuyerFromOCR(text);
        buyerName = buyerName || fromOCR.buyerName;
        buyerRUC = buyerRUC || fromOCR.buyerRUC;
      }
    }

    // -----------------------------
    // TOTALS: layout-first, OCR fallback
    // -----------------------------
    
    let totalsPageItems = page1Items;

    // If more than one page, search for the totals page
    if (pageCount > 1) {
      for (let i = allPagesItems.length - 1; i >= 0; i--) {
        if (pageHasTotals(allPagesItems[i])) {
          totalsPageItems = allPagesItems[i];
          break;
        }
      }
    }

    // 1️⃣ Try layout FIRST, always
    let totals = detectTotalsFromLayout(totalsPageItems);

    // 2️⃣ Only fallback to OCR if layout failed to detect ANY tax structure
    const layoutLooksValid =
      totals.taxableWithVat > 0 ||
      totals.taxable0 > 0 ||
      totals.nonTaxable > 0 ||
      totals.iva > 0 ||
      totals.total > 0;

    if (!layoutLooksValid) {
      totals = detectTotalsFromOCR(text);
      parseWarnings.push("Layout totals not detected; used OCR totals fallback.");
    }

    // Normalize totals (single pass)
    totals = normalizeSriTotals(totals, parseWarnings);

    if (process.env.NODE_ENV !== "production") {
      console.log("FINAL TOTALS DECISION", {
        pageCount,
        taxableWithVat: totals.taxableWithVat,
        taxable0: totals.taxable0,
        nonTaxable: totals.nonTaxable,
        iva: totals.iva,
        taxRate: totals.taxRate,
        ice: totals.ice,
        total: totals.total,
      });
    }

    // ------------------------------------------------------------------
    // PARSED STRUCTURE
    // ------------------------------------------------------------------
    const parsed: ParsedInternal = {
      issuerRUC,
      issuerName: issuerName || "",

      buyerName,
      buyerRUC,

      invoice_number,
      invoiceDate: extractInvoiceDate(text, page1Items),
      concepto: "",

      taxableBase: totals.taxableWithVat,
      taxRate: totals.taxRate,
      subtotal0: totals.taxable0,
      nonTaxable: totals.nonTaxable,

      iva: totals.iva,
      ice: totals.ice,
      total: totals.total,

      ocr_text: text,
      warnings: parseWarnings.length ? parseWarnings : undefined,
    };

    if (!parsed.invoice_number) {
      parsed.warnings = [
        ...(parsed.warnings ?? []), 
        "Invoice number not detected."
      ];
    }

    // Expense context
    if (invoiceType === "expense") {
      const ctx = extractExpenseContextFromItems(page1Items, text);
      if (ctx?.concepto) parsed.concepto = ctx.concepto;
    }

    // Fallback for concept
    parsed.concepto = 
      parsed.concepto || 
      `Compra a ${parsed.issuerName}` || 
      "Gasto sin descripcion";

    // ------------------------------------------------------------------
    // ACCOUNTING
    // ------------------------------------------------------------------
    const reqId = randomUUID();
    console.log("REQ:", reqId, "START");

    
    const { lines, warnings: accountingWarnings } = 
      await buildAccounting(parsed, uid, invoiceType);

    console.log("REQ:", reqId, "LINES:", lines.length, lines.map(l => l.accountCode));  
    console.log("BACKEND LINES COUNT:", lines.length);
    console.log("BACKEND LINES:", lines.map(l => l.accountCode));
  

    const transactionId = randomUUID();
    const balance = {
      debit: Number(lines.reduce((s, l) => s + safeNumber(l.debit), 0).toFixed(2)),
      credit: Number(lines.reduce((s, l) => s + safeNumber(l.credit), 0).toFixed(2)),
    };

    if (Math.abs(balance.debit - balance.credit) > 0.01) {
      accountingWarnings.push("Unbalanced journal entry detected in backend.");
    }

    const allWarnings =
      [...(parsed.warnings ?? []), ...accountingWarnings].length
        ? [...(parsed.warnings ?? []), ...accountingWarnings]
        : undefined;

    // ------------------------------------------------------------------
    // RESPONSE
    // ------------------------------------------------------------------
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        invoiceType,

        __extraction: {
          pageCount,
          source: pageCount > 1 ? "ocr" : "layout",
        },

        // =========================
        // HEADER DATA
        // =========================
        issuerRUC: parsed.issuerRUC,
        issuerName: parsed.issuerName,

        buyerName: parsed.buyerName,
        buyerRUC: parsed.buyerRUC,

        invoice_number: parsed.invoice_number,
        invoice_number_normalized: parsed.invoice_number?.replace(/\D/g, "") || "",

        invoiceDate: parsed.invoiceDate,

        // =========================
        // TAX STRUCTURE (GLOBAL)
        // =========================
        taxableBase: parsed.taxableBase,
        taxRate: parsed.taxRate,
        subtotal0: parsed.subtotal0,
        nonTaxable: parsed.nonTaxable,
        iva: parsed.iva,
        ice: parsed.ice,
        total: parsed.total,

        concepto: parsed.concepto,
        ocr_text: parsed.ocr_text,

        warnings: allWarnings,
        balance,

        // =========================
        // JOURNAL ENTRIES
        // =========================
        entries: lines.map((l) => {
          const base = {
            id: randomUUID(),
            transactionId,

            // -------------------------
            // ACCOUNTING CORE
            // -------------------------
            account_code: l.accountCode,
            account_name: l.accountName,
            debit: Number(safeNumber(l.debit).toFixed(2)),
            credit: Number(safeNumber(l.credit).toFixed(2)),

            issuerRUC: parsed.issuerRUC,
            issuerName: parsed.issuerName,
            entityRUC: userRUC,

            // -------------------------
            // DOCUMENT CONTEXT
            // -------------------------
            invoice_number: parsed.invoice_number,
            invoice_number_normalized: parsed.invoice_number?.replace(/\D/g, "") || "",
            date: parsed.invoiceDate,

            transactionType: "invoice",
            documentType: "invoice",

            // -------------------------
            // TAX DATA (CRITICAL)
            // -------------------------
            taxableBase: parsed.taxableBase,
            taxRate: parsed.taxRate,
            subtotal0: parsed.subtotal0,
            nonTaxable: parsed.nonTaxable,
            iva: parsed.iva,
            ice: parsed.ice,
            total: parsed.total,

            // -------------------------
            // SYSTEM FLAGS (CRITICAL)
            // -------------------------
            isPayable: invoiceType === "expense" && l.credit > 0,
            isReceivable: invoiceType === "sale" && l.debit > 0,

            // -------------------------
            // TRACEABILITY
            // -------------------------
            source: "vision",
            createdAt: new Date().toISOString(),
          };

          if (invoiceType === "sale") {
            return {
              ...base,
              customer_name: parsed.buyerName,
              customerRUC: parsed.buyerRUC,
            };
          }

          return {
            ...base,
            supplier_name: parsed.issuerName,
            supplier_ruc: parsed.issuerRUC,
          }
      }),
      } satisfies FunctionResponse),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: err?.message || "Unexpected error",
      } satisfies FunctionResponse),
    };
  }
};

