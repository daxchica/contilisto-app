/**
 * ECUADOR SRI RULE:
 * The issuer RUC (top-right SRI block) decides invoice type.
 * If issuerRUC === entityRUC → SALE
 * Else → EXPENSE
 * Never guess this using buyer data or GPT.
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
import { getContextualHint } from "./_server/contextualHintsService";
import { extractExpenseContextFromItems } from "./_server/extractExpenseContext";

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

function extractInvoiceNumber(text: string, items: TextItemLite[]) {
  const fromLayout = items.find((i) => /\b\d{3}-\d{3}-\d{6,}\b/.test(i.str.replace(/\s+/g, "")));
  if (fromLayout) return fromLayout.str.replace(/\s+/g, "");

  const m = (text || "").match(/\b\d{3}-\d{3}-\d{6,}\b/);
  return m?.[0] ?? "";
}

function extractInvoiceDate(text: string, items: TextItemLite[]) {
  const dateRe = /\b\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}:\d{2})?\b/;

  const fromLayout = items.find((i) => dateRe.test(i.str));
  if (fromLayout) return fromLayout.str.trim().slice(0, 10);

  const m = (text || "").match(dateRe);
  return (m?.[0] ?? "").slice(0, 10);
}

// ---------------------------------------------------------------------------
// TOTALS DETECTION (LAYOUT + OCR) — ECUADOR SRI 3-CATEGORY MODEL
// ---------------------------------------------------------------------------

const MONEY_GLOBAL = /([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/g;

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

function pickRightmostMoney(lineText: string): number {
  const s = String(lineText || "");
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
  const t = (text || "").replace(/\s+/g, " ").toUpperCase();

  const pick = (re: RegExp) => {
    const m = t.match(re);
    return parseMoney(m?.[1] ?? "");
  };

  // Priority: explicit subtotals by rate
  const subtotal15 = pick(/SUBTOTAL\s*15\s*%?[\s\S]{0,40}?([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/);
  
  const subtotal12 =
    pick(/SUBTOTAL\s*12\s*%?[\s\S]{0,40}?([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/);

  // ✅ SAFE SUBTOTAL 0%
  const subtotal0 =
    pick(/SUBTOTAL\s*0\s*%?[\s\S]{0,40}?([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/) || 0;
    
  // Non-taxable: both NO OBJETO and EXENTO may exist
  const noObjeto =
    pick(/SUBTOTAL\s+NO\s+OBJETO\s+DE\s+IVA[\s\S]{0,40}?([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/) || 0;
  const exento =
    pick(/SUBTOTAL\s+EXENTO\s+DE\s+IVA[\s\S]{0,40}?([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/) || 0;

  // IVA
  const iva =
    pick(/IVA\s*(?:12|15)\s*%?[\s\S]{0,30}?([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/) || 0;

  // ICE (rare)
  const ice =
    pick(/\bICE\b[\s\S]{0,30}?([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/) || 0;

  // Total: prefer "VALOR TOTAL"
  const total =
    pick(/VALOR\s*TOTAL[\s\S]{0,30}?([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/) ||
    pick(/TOTAL\s*A\s*PAGAR[\s\S]{0,30}?([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/) ||
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
// ACCOUNTING (NO CAMBIOS) — includes AP line for expenses always
// ---------------------------------------------------------------------------

async function buildAccounting(entry: ParsedInternal, uid: string, invoiceType: "sale" | "expense"
) {
  const lines: AccountingLine[] = [];
  const warnings: string[] = [];

  if (invoiceType === "sale") {
    lines.push({
      accountCode: "13010101",
      accountName: "Clientes",
      debit: safeNumber(entry.total),
      credit: 0,
    });

    // Revenue base = taxableWithVat + taxable0 + nonTaxable
    lines.push({
      accountCode: "401010101",
      accountName: "Ingresos por servicios",
      debit: 0,
      credit: safeNumber(entry.taxableBase + entry.subtotal0 + entry.nonTaxable),
    });

    if (entry.iva > 0) {
      lines.push({
        accountCode: "213010101",
        accountName: "IVA débito en ventas",
        debit: 0,
        credit: safeNumber(entry.iva),
      });
    }

    return { lines, warnings };
  }

  // EXPENSE
  let expenseCode = "502010101";
  let expenseName = "Gastos en servicios generales";

  if (uid && entry.issuerRUC && entry.concepto) {
    const hint = await getContextualHint(uid, entry.issuerRUC, entry.concepto);
    if (hint?.accountCode) {
      expenseCode = hint.accountCode;
      expenseName = hint.accountName;
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
      accountCode: "133010102",
      accountName: "IVA crédito en compras",
      debit: safeNumber(entry.iva),
      credit: 0,
    });
  }

  // Always AP line (proveedor) for expenses
  lines.push({
    accountCode: "201030102",
    accountName: "Proveedores locales",
    debit: 0,
    credit: safeNumber(entry.total),
  });

  return { lines, warnings };
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
    const { text, page1Items, allPagesItems, pageCount } = await extractText(buffer);

    // Issuer name: LEFT margin, Cuadro 1
    const issuerName = extractIssuerNameFromLayout(page1Items);

    // Issuer RUC: from OCR text
    const issuerRUC = extractIssuerRUCFromText(text);

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

    const parseWarnings: string[] = [];
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

    const parsed: ParsedInternal = {
      issuerRUC,
      issuerName: issuerName || "",

      buyerName,
      buyerRUC,

      invoice_number: extractInvoiceNumber(text, page1Items),
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
      parsed.warnings = [...(parsed.warnings ?? []), "Invoice number not detected."];
    }

    // Expense context
    if (invoiceType === "expense") {
      const ctx = extractExpenseContextFromItems(page1Items, text);
      if (ctx?.concepto) parsed.concepto = ctx.concepto;
    }

    // Fallback for concept
    parsed.concepto = parsed.concepto || parsed.invoice_number || "Expense (no description)";

    const { lines, warnings: accountingWarnings } = await buildAccounting(parsed, uid, invoiceType);

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

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        invoiceType,
        __extraction: {
          pageCount,
          source: pageCount > 1 ? "ocr" : "layout",
        },

        issuerRUC: parsed.issuerRUC,
        issuerName: parsed.issuerName,

        buyerName: parsed.buyerName,
        buyerRUC: parsed.buyerRUC,

        invoice_number: parsed.invoice_number,
        invoiceDate: parsed.invoiceDate,

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

        entries: lines.map((l) => ({
          id: randomUUID(),
          transactionId,
          account_code: l.accountCode,
          account_name: l.accountName,
          debit: Number(safeNumber(l.debit).toFixed(2)),
          credit: Number(safeNumber(l.credit).toFixed(2)),
          issuerRUC: parsed.issuerRUC,
          entityRUC: userRUC,
          source: "vision",
        })),
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

