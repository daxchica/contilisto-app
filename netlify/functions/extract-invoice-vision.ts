/**
 * ECUADOR SRI RULE:
 * The issuer RUC (top-right SRI block) decides invoice type.
 * If issuerRUC === entityRUC → SALE
 * Else → EXPENSE
 * Never guess this using buyer data or GPT.
 */
// ============================================================================
// CONTILISTO — extract-invoice-vision.ts (STABLE CONTRACT)
// OCR ONLY (no guessing)
// IMPORTANT FIX: Never 500 on "unbalanced entry".
// Balance is enforced in JournalPreviewModal (UI) before saving.
// ============================================================================

import { Handler } from "@netlify/functions";
import { randomUUID } from "crypto";
import { getContextualHint } from "./_server/contextualHintsService";

// -------------------------------
// INVOICE TYPE
// -------------------------------
function determineInvoiceType(
  issuerRUC: string,
  entityRUC: string
): "sale" | "expense" {
  const clean = (v: string) => (v || "").replace(/\D/g, "");

  if (!issuerRUC || !entityRUC) {
    // Defensive default: EXPENSE (never assume sale)
    return "expense";
  }

  return clean(issuerRUC) === clean(entityRUC) ? "sale" : "expense";
}

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface ParsedInternal {
  issuerRUC: string;
  issuerName: string;

  buyerName: string;
  buyerRUC: string;

  invoiceDate: string;
  invoice_number: string;
  concepto: string;

  subtotal15: number;
  subtotal0: number;
  iva: number;
  ice: number;
  total: number;

  ocr_text: string;

  ocrConfidence?: {
    totalsDetected: boolean;
    ivaDetected: boolean;
    iceDetected: boolean;
    usedFallback: boolean;
  };

  // For debugging / UI messaging (optional)
  warnings?: string[];
}

type AccountingLine = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
};

// Stable response contract (frontend expects these fields)
type FunctionResponse = {
  success: boolean;
  invoiceType?: "sale" | "expense";

  issuerRUC?: string;
  issuerName?: string;

  buyerName?: string;
  buyerRUC?: string;

  invoiceDate?: string;
  invoice_number?: string;

  subtotal15?: number;
  subtotal0?: number;
  iva?: number;
  ice?: number;
  total?: number;

  concepto?: string;
  ocr_text?: string;

  entries?: Array<{
    id: string;
    transactionId: string;
    account_code: string;
    account_name: string;
    debit: number;
    credit: number;
    issuerRUC: string;
    entityRUC: string;
    source: string;
  }>;

  // Additional non-breaking debug info (frontend can ignore)
  warnings?: string[];
  balance?: {
    debit: number;
    credit: number;
    diff: number;
    balanced: boolean;
  };
  ocrConfidence?: ParsedInternal["ocrConfidence"];
  error?: string;
};

// ---------------------------------------------------------------------------
// OCR (PDF.js text + layout items)
// ---------------------------------------------------------------------------

type TextItemLite = {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type ExtractedTextResult = {
  text: string;
  page1Items: TextItemLite[];
};

async function extractText(data: Uint8Array): Promise<ExtractedTextResult> {
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const path = await import("path");
  const { pathToFileURL } = await import("url");

  // ✅ Resilient fonts handling:
  // IMPORTANT: some pdfjs builds warn if standardFontDataUrl missing.
  // We try to set it. If it fails, we still proceed.
  let standardFontDataUrl: string | undefined;
  try {
    const fontsPath = path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "standard_fonts"
    );
    standardFontDataUrl = pathToFileURL(fontsPath + path.sep).toString();
  } catch {
    standardFontDataUrl = undefined;
  }

  const doc = await pdfjsLib.getDocument({
    data,
    disableWorker: true,
    standardFontDataUrl,
  }).promise;

  let fullText = "";
  let page1Items: TextItemLite[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    // Extract plain concatenated text (existing behavior)
    const pageText = content.items.map((x: any) => ` ${x.str || ""}`).join("");
    fullText += pageText;

    // Capture layout items ONLY for first page (invoice head lives here)
    if (i === 1) {
      const items: TextItemLite[] = [];
      for (const it of content.items as any[]) {
        const s = String(it?.str ?? "").trim();
        if (!s) continue;

        // pdfjs: transform = [a,b,c,d,e,f]
        const tr = it.transform;
        const x = Number(tr?.[4] ?? 0);
        const y = Number(tr?.[5] ?? 0);
        const w = Number(it.width ?? 0);
        const h = Number(it.height ?? 0);

        items.push({ str: s, x, y, w, h });
      }
      page1Items = items;
    }
  }

  const text = fullText
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();

  return { text, page1Items };
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const cleanRuc = (v: string) => (v || "").replace(/\D/g, "");

function safeNumber(n: any): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

// Handles "1.234,56" and "1234.56"
function parseMoney(raw: string): number {
  if (!raw) return 0;
  const s = raw.trim();

  if (s.includes(".") && s.includes(",")) {
    const normalized = s.replace(/\./g, "").replace(",", ".");
    return safeNumber(parseFloat(normalized));
  }

  if (s.includes(",") && !s.includes(".")) {
    return safeNumber(parseFloat(s.replace(",", ".")));
  }

  return safeNumber(parseFloat(s));
}

function isProbablyNoiseOrLabel(upper: string): boolean {
  const forbidden = [
    "FACTURA",
    "AUTORIZACION",
    "AUTORIZACIÓN",
    "NUMERO DE AUTORIZACION",
    "NÚMERO DE AUTORIZACIÓN",
    "FECHA Y HORA",
    "CLAVE DE ACCESO",
    "AMBIENTE",
    "EMISION",
    "OBLIGADO A LLEVAR CONTABILIDAD",
    "DIRECCION",
    "MATRIZ",
    "SUCURSAL",
    "RAZON SOCIAL",
    "RAZÓN SOCIAL",
    "NOMBRES Y APELLIDOS",
    "IDENTIFICACION",
    "IDENTIFICACIÓN",
    "GUIA",
    "GUÍA",
    "R.U.C",
    "RUC",
    "NO TIENE LOGO",
  ];

  if (forbidden.some((f) => upper.includes(f))) return true;

  // too many digits -> likely not a pure name
  const digitCount = (upper.match(/\d/g) || []).length;
  if (digitCount >= 4) return true;

  return false;
}

function normalizeNameCandidate(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/[|]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normUpper(s: string): string {
  return (s || "")
    .toUpperCase()
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function within(a: number, b: number, tol: number) {
  return Math.abs(a - b) <= tol;
}

// ---------------------------------------------------------------------------
// ISSUER (LAYOUT-FIRST)
// ---------------------------------------------------------------------------

/**
 * Extract issuer RUC and issuer name using PAGE-1 layout items (preferred).
 * Strategy:
 * - Find issuer RUC in top-right SRI block (R.U.C or nearest 13-digit in top-right)
 * - Then search top-left header region for the best uppercase-ish long candidate
 */
function extractInvoiceHeadFromLayout(page1Items: TextItemLite[]) {
  if (!page1Items?.length) {
    return { issuerRUC: "", issuerName: "" };
  }

  // Determine coordinate ranges
  const xs = page1Items.map((i) => i.x);
  const ys = page1Items.map((i) => i.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // We'll avoid assuming direction by using relative "maxY" as top region:
  const isTopRegion = (it: TextItemLite) => it.y >= maxY - (maxY - minY) * 0.45;

  const topItems = page1Items.filter(isTopRegion);

  // Right block likely contains R.U.C and SRI details
  const rightThreshold = minX + (maxX - minX) * 0.55;
  const rightTopItems = topItems.filter((it) => it.x >= rightThreshold);

  // 1) Find issuerRUC in top-right block
  const rucRegex = /\b(\d{13})\b/;
  let issuerRUC = "";

  // Prefer item after "R.U.C"
  for (let idx = 0; idx < rightTopItems.length; idx++) {
    const u = rightTopItems[idx].str.toUpperCase();
    if (u.includes("R.U.C") || u === "RUC" || u.includes("RUC:")) {
      // Look forward a few items for 13 digits
      for (let j = idx; j < Math.min(idx + 8, rightTopItems.length); j++) {
        const m = rightTopItems[j].str.match(rucRegex);
        if (m?.[1]) {
          issuerRUC = m[1];
          break;
        }
      }
    }
    if (issuerRUC) break;
  }

  // Fallback: any 13-digit near top-right
  if (!issuerRUC) {
    const candidates = rightTopItems
      .map((it) => it.str.match(rucRegex)?.[1])
      .filter(Boolean) as string[];

    issuerRUC = candidates[0] ?? "";
  }

  // 2) Extract issuerName from top-left header zone
  const leftTopItems = topItems.filter((it) => it.x < rightThreshold);

  // Sort by y desc (top to bottom) then x asc
  const sorted = [...leftTopItems].sort((a, b) => {
    if (Math.abs(b.y - a.y) > 2) return b.y - a.y;
    return a.x - b.x;
  });

  // Build line groups (y buckets)
  const lines: Array<{ y: number; text: string }> = [];
  const yTolerance = 3.5;

  for (const it of sorted) {
    const text = normalizeNameCandidate(it.str);
    if (!text) continue;

    const upper = text.toUpperCase();
    if (isProbablyNoiseOrLabel(upper)) continue;

    if (!/^[A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 .,&'-]{2,}$/.test(upper)) continue;

    let bucket = lines.find((l) => Math.abs(l.y - it.y) <= yTolerance);
    if (!bucket) {
      bucket = { y: it.y, text };
      lines.push(bucket);
    } else {
      bucket.text = normalizeNameCandidate(`${bucket.text} ${text}`);
    }
  }

  const scored = lines
    .map((l) => {
      const t = l.text.trim();
      const up = t.toUpperCase();
      const len = up.length;
      const wordCount = up.split(/\s+/).filter(Boolean).length;
      const topScore = l.y;
      const score = topScore * 0.002 + len + wordCount * 5;
      return { ...l, candidate: t, score };
    })
    .filter((x) => x.candidate.length >= 12 && x.candidate.length <= 90)
    .sort((a, b) => b.score - a.score);

  const issuerName = scored[0]?.candidate ?? "";

  return { issuerRUC: issuerRUC || "", issuerName: issuerName || "" };
}

/**
 * Existing text-only issuer extraction, improved by:
 * - First try layout-based extraction
 * - Then fallback to original OCR-string heuristics
 */
function extractIssuerFromOCR(text: string, page1Items?: TextItemLite[]) {
  // 0) Layout-first (preferred)
  if (page1Items?.length) {
    const fromLayout = extractInvoiceHeadFromLayout(page1Items);
    if (fromLayout.issuerRUC) {
      return fromLayout;
    }
  }

  // 1) Fallback to original text heuristics
  const upper = text
    .toUpperCase()
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const rucMatch =
    upper.match(/\bR\s*\.?\s*U\s*\.?\s*C\b\s*[:\-]?\s*(\d{13})/) ??
    upper.match(/\b(\d{13})\b/);

  const issuerRUC = rucMatch?.[1] ?? "";
  if (!issuerRUC) return { issuerRUC: "", issuerName: "" };

  const forbidden = [
    "FACTURA",
    "AUTORIZACION",
    "AUTORIZACIÓN",
    "FECHA Y HORA",
    "NUMERO DE AUTORIZACION",
    "NÚMERO DE AUTORIZACIÓN",
    "CLAVE DE ACCESO",
    "AMBIENTE",
    "EMISION",
    "OBLIGADO A LLEVAR CONTABILIDAD",
    "DIRECCION",
    "MATRIZ",
    "SUCURSAL",
    "NO RAZON SOCIAL",
    "NO RAZÓN SOCIAL",
    "NOMBRES Y APELLIDOS",
    "IDENTIFICACION",
    "IDENTIFICACIÓN",
    "GUIA",
    "GUÍA",
  ];

  const isValidName = (s: string) =>
    s.length >= 15 &&
    s.length <= 80 &&
    /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .]+$/.test(s) &&
    !forbidden.some((f) => s.includes(f));

  const rucIndex = upper.indexOf(issuerRUC);
  const window = upper.slice(Math.max(0, rucIndex - 300), rucIndex);

  const pass1 = window
    .replace(/\b\d{6,}\b/g, "")
    .split(/\s{2,}/)
    .map((s) => s.trim())
    .find(isValidName);

  if (pass1) {
    return { issuerRUC, issuerName: pass1 };
  }

  const buyerIdx = upper.indexOf("RAZON SOCIAL / NOMBRES Y APELLIDOS");
  const headerOnly = buyerIdx > 0 ? upper.slice(0, buyerIdx) : upper;

  const pass2 = headerOnly
    .replace(/\b\d{6,}\b/g, "")
    .match(/\b[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .]{15,80}\b/g)
    ?.find(isValidName);

  return {
    issuerRUC,
    issuerName: pass2 ?? "",
  };
}


// ---------------------------------------------------------------------------
// BUYER (LAYOUT-FIRST)  ✅ THIS IS THE UPGRADE YOU NEED
// ---------------------------------------------------------------------------

/**
 * Extract buyerName + buyerRUC from the "customer info" block using layout items.
 * This avoids OCR ordering issues on sales invoices.
 */
function extractBuyerFromLayout(page1Items: TextItemLite[]) {
  if (!page1Items?.length) return { buyerName: "", buyerRUC: "" };

  const items = page1Items
    .map((it) => ({ ...it, u: normUpper(it.str) }))
    .filter((it) => it.u.length > 0);

  const findLabel = (predicate: (line: string) => boolean) => {
    const yTol = 3.5;

    // group items by visual line
    const lines: { y: number; items: typeof items }[] = [];

    for (const it of items) {
      let line = lines.find(l => Math.abs(l.y - it.y) <= yTol);
      if (!line) {
        line = { y: it.y, items: [it] };
        lines.push(line);
      } else {
        line.items.push(it);
      }
    }

    for (const line of lines) {
      const text = line.items
        .sort((a, b) => a.x - b.x)
        .map(it => it.u)
        .join(" ");

      if (predicate(text)) {
        // return the LEFTMOST item as label anchor
        return line.items.sort((a, b) => a.x - b.x)[0];
      }
    }

    return null;
  };

  // Labels commonly present in SRI invoice
  const normalize = (s: string) => 
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const nameLabel =
    findLabel((u) => u.includes("RAZON SOCIAL / NOMBRES Y APELLIDOS")) ||
    findLabel((u) => u.includes("RAZON SOCIAL/NOMBRES Y APELLIDOS")) ||
    findLabel((u) => 
      normalize(u).includes("RAZON SOCIAL") &&
      normalize(u).includes("NOMBRES")) ||
    null;

  const idLabel =
    findLabel((u) => u.includes("IDENTIFICACION")) ||
    findLabel((u) => u.includes("IDENTIFICACIÓN")) ||
    findLabel((u) => u.includes("CI/RUC")) ||
    null;

  const yTol = 4.0;

  const readBuyerNameAboveIdentification = () => {
  const idLabel = items.find(it =>
    it.u.includes("IDENTIFICACION") ||
    it.u.includes("IDENTIFICACIÓN") ||
    it.u.includes("CI/RUC")
  );

  if (!idLabel) return "";

  // All text ABOVE the ID line
  const candidates = items
    .filter(it => it.y < idLabel.y - 2)
    .sort((a, b) => b.y - a.y);

  // Group by visual lines
  const lines: { y: number; text: string }[] = [];
  const yTol = 3.5;

  for (const it of candidates) {
    let bucket = lines.find(l => Math.abs(l.y - it.y) <= yTol);
    if (!bucket) {
      bucket = { y: it.y, text: it.str };
      lines.push(bucket);
    } else {
      bucket.text += " " + it.str;
    }
  }

  // Take the CLOSEST valid uppercase line
  for (let i = lines.length - 1; i >= 0; i--) {
    const text = normalizeNameCandidate(lines[i].text);
    const upper = text.toUpperCase();

    if (
      /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .&]{8,}$/.test(text) &&
      !upper.includes("RAZON SOCIAL") &&
      !upper.includes("NOMBRES") &&
      !upper.includes("DIRECCION") &&
      !upper.includes("FECHA")
    ) {
      console.log("🧾 BUYER NAME LINE:", text);
      return text;
    }
  }

  return "";
};

  const readDigitsRightOf = (label: { x: number; y: number; w: number }) => {
    const sameLine = items
      .filter(it => within(it.y, label.y, yTol))
      .sort((a, b) => a.x - b.x);

    const fullLine = sameLine.map(it => it.str).join(" ");

    // 🔍 DEBUG — SHOW EXACT LINE OCR IS READING
    console.log("🧾 BUYER LINE (same Y):", fullLine);

    // Take ONLY text to the right of the label
  const right = sameLine.filter(
    it => it.x > label.x + Math.max(20, label.w * 0.6)
  );
    
    // look for 10-13 digits anywhere in the right side
    const joined = right.map((r) => r.str).join(" ");
    const m = joined.match(/\b(\d{10,13})\b/);

    return cleanRuc(m?.[1] ?? "");
  };

  const readNameRightOf = (label: { x: number; y: number; w: number }) => {
    const sameLine = items
      .filter(it => within(it.y, label.y, yTol))
      .sort((a, b) => a.x - b.x);

    const fullLine = sameLine.map(it => it.str).join(" ");

    console.log("🧾 NAME LINE (same Y):", fullLine);

    const right = sameLine.filter(
      it => it.x > label.x + Math.max(20, label.w * 0.6)
    );

    const text = normalizeNameCandidate(
      right.map(r => r.str).join(" ")
    );

    const upper = text.toUpperCase();

    if (
      /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .&]{6,}$/.test(text) &&
      !upper.includes("DIRECCION") &&
      !upper.includes("FECHA")
    ) {
      return text;
    }

    return "";
  };

  let buyerName = "";
  let buyerRUC = "";

  if (nameLabel) {
    buyerName = readNameRightOf(nameLabel);
  }

  if (idLabel) {
    buyerRUC = readDigitsRightOf(idLabel);
  }

  return {
    buyerName: (buyerName || "").trim(),
    buyerRUC: cleanRuc(buyerRUC),
  };
}

function extractBuyerFromOCR(text: string, page1Items?: TextItemLite[]) {
  // 0) Layout-first (preferred)
  if (page1Items?.length) {
    const fromLayout = extractBuyerFromLayout(page1Items);
    if (fromLayout.buyerName || fromLayout.buyerRUC) return fromLayout;
  }

  // 1) Fallback to your original regex method
  const t = text.toUpperCase().replace(/\s+/g, " ");

  const name =
    t.match(
      /RAZON SOCIAL\s*\/\s*NOMBRES Y APELLIDOS:\s*([A-ZÁÉÍÓÚÑ0-9 .]{3,})/
    )?.[1] ?? "";

  const start = t.indexOf("RAZON SOCIAL / NOMBRES Y APELLIDOS:");
  const tail = start >= 0 ? t.slice(start, start + 900) : t;

  const ruc =
    tail.match(/IDENTIFICACION\s*[:\-]?\s*(\d{10,13})/)?.[1] ??
    tail.match(/CI\/RUC\s*[:\-]?\s*(\d{10,13})/)?.[1] ??
    "";

  return {
    buyerName: (name || "").trim(),
    buyerRUC: cleanRuc(ruc),
  };
}

function extractInvoiceNumber(text: string): string {
  const t = text.toUpperCase().replace(/\s+/g, " ");

  const m =
    t.match(/FACTURA\s*(?:N[Oº°]\.?\s*)?(\d{3}\s*-\s*\d{3}\s*-\s*\d{6,})/)
      ?.[1] ??
    t.match(/\b(\d{3}\s*-\s*\d{3}\s*-\s*\d{6,})\b/)?.[1] ??
    "";

  return (m || "").replace(/\s*-\s*/g, "-").trim();
}

function extractInvoiceDate(text: string): string {
  const t = text.toUpperCase();

  const auth =
    t.match(
      /FECHA\s+Y\s+HORA\s+DE\s+AUTORIZACION\s*[:\-]?\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/
    )?.[1];

  if (auth) return auth;

  return t.match(/\b([0-9]{2}\/[0-9]{2}\/[0-9]{4})\b/)?.[1] ?? "";
}

// ---------------------------------------------------------------------------
// TOTALS (robust + safe fallback + Ecuador ICE/IVA safety swap)
// ---------------------------------------------------------------------------

function detectTotals(text: string) {
  const n = text
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[|]/g, " ")
    .trim();

  const pick = (re: RegExp): number => {
    const m = n.match(re);
    const raw = m?.[1] ?? "";
    return parseMoney(raw);
  };

  let subtotal15 = pick(/SUBTOTAL\s*(?:15|12)\s*%?\s*([0-9.,]{3,})/) || 0;

  let subtotal0 =
    pick(/SUBTOTAL\s*0\s*%?\s*([0-9.,]{3,})/) ||
    pick(/SUBTOTAL\s*NO\s*OBJETO\s*DE\s*IVA\s*([0-9.,]{3,})/) ||
    pick(/SUBTOTAL\s*EXENTO\s*DE\s*IVA\s*([0-9.,]{3,})/) ||
    0;

  let iva = pick(/IVA\s*(?:15|12)\s*%?\s*([0-9.,]{3,})/) || 0;

  let ice = pick(/ICE\s*([0-9.,]{3,})/) || 0;

  let total =
    pick(/VALOR\s*TOTAL\s*([0-9.,]{3,})/) ||
    pick(/IMPORTE\s*TOTAL\s*([0-9.,]{3,})/) ||
    pick(/\bTOTAL\b\s*([0-9.,]{3,})/) ||
    0;

  let usedFallback = false;

  if (total === 0 && (subtotal15 || subtotal0 || iva || ice)) {
    total = Number((subtotal15 + subtotal0 + iva + ice).toFixed(2));
    usedFallback = true;
  }

  const base = subtotal15 + subtotal0;
  if (ice > 0 && iva === 0 && base > 0 && Math.abs(total - (base + ice)) < 0.01) {
    iva = ice;
    ice = 0;
  }

  const totalsDetected = total > 0 || base > 0;
  const ivaDetected = iva > 0;
  const iceDetected = ice > 0;

  return {
    subtotal15,
    subtotal0,
    iva,
    ice,
    total,
    ocrConfidence: {
      totalsDetected,
      ivaDetected,
      iceDetected,
      usedFallback,
    },
  };
}

// ---------------------------------------------------------------------------
// ACCOUNTING (IMPORTANT: do NOT throw on imbalance)
// ---------------------------------------------------------------------------

function computeBalance(lines: AccountingLine[]) {
  const debit = lines.reduce((s, l) => s + safeNumber(l.debit), 0);
  const credit = lines.reduce((s, l) => s + safeNumber(l.credit), 0);
  const diff = Number((debit - credit).toFixed(2));
  const balanced = Math.abs(diff) < 0.01;
  return { debit, credit, diff, balanced };
}

/**
 * Build suggested lines from OCR totals.
 * IMPORTANT: This must NEVER throw due to imbalance.
 * The Preview Modal will enforce balancing before saving.
 */
async function buildAccounting(
  entry: ParsedInternal,
  uid: string,
  invoiceType: "sale" | "expense"
) {
  // ⚠️ UNCHANGED — as requested
  const lines: AccountingLine[] = [];
  const warnings: string[] = [];

  if (invoiceType === "sale") {
    const base = safeNumber(entry.subtotal15) + safeNumber(entry.subtotal0);

    if (entry.total > 0) {
      lines.push({
        accountCode: "13010101",
        accountName: "Clientes",
        debit: safeNumber(entry.total),
        credit: 0,
      });
    } else {
      warnings.push("No se detectó TOTAL; asiento puede requerir ajuste.");
    }

    if (base > 0) {
      lines.push({
        accountCode: "401010101",
        accountName: "Ingresos por servicios",
        debit: 0,
        credit: safeNumber(base),
      });
    } else {
      warnings.push("No se detectó SUBTOTAL base; asiento puede requerir ajuste.");
    }

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

  let expenseCode = "502010101";
  let expenseName = "Gastos en servicios generales";

  if (uid && entry.issuerRUC && entry.concepto) {
    try {
      const hint = await getContextualHint(uid, entry.issuerRUC, entry.concepto);
      if (hint?.accountCode) {
        expenseCode = hint.accountCode;
        expenseName = hint.accountName || expenseName;
      }
    } catch {
      // no-op: hints should never break OCR
    }
  }

  const base = safeNumber(entry.subtotal15) + safeNumber(entry.subtotal0);

  if (base > 0) {
    lines.push({
      accountCode: expenseCode,
      accountName: expenseName,
      debit: safeNumber(base),
      credit: 0,
    });
  } else {
    warnings.push("No se detectó SUBTOTAL base; asiento puede requerir ajuste.");
  }

  if (entry.iva > 0) {
    lines.push({
      accountCode: "133010102",
      accountName: "IVA crédito en compras",
      debit: safeNumber(entry.iva),
      credit: 0,
    });
  }

  if (entry.total > 0) {
    lines.push({
      accountCode: "201030102",
      accountName: "Proveedores locales",
      debit: 0,
      credit: safeNumber(entry.total),
    });
  } else {
    warnings.push("No se detectó TOTAL; asiento puede requerir ajuste.");
  }

  return { lines, warnings };
}

// ---------------------------------------------------------------------------
// HANDLER
// ---------------------------------------------------------------------------

export const handler: Handler = async (event) => {
  try {
    const { base64, userRUC, uid } = JSON.parse(event.body || "{}");

    if (!base64 || !userRUC) {
      return {
        statusCode: 400,
        body: "Missing base64 or userRUC",
      };
    }

    const buffer = new Uint8Array(Buffer.from(base64, "base64"));
    const { text: ocrText, page1Items } = await extractText(buffer);

    // ✅ invoice-head improved (layout-first)
    const issuer = extractIssuerFromOCR(ocrText, page1Items);

    if (!issuer.issuerRUC) {
      const resp: FunctionResponse = {
        success: false,
        error: "No se pudo detectar el RUC del emisor en el bloque superior.",
        ocr_text: ocrText,
      };
      return { statusCode: 200, body: JSON.stringify(resp) };
    }

    const invoiceType = determineInvoiceType(issuer.issuerRUC, userRUC);

    console.log("🧾 INVOICE TYPE DECISION", {
      issuerRUC: issuer.issuerRUC,
      entityRUC: userRUC,
      invoiceType,
    });

    // ✅ BUYER: layout-first (customer section), then fallback to regex
    const buyer = extractBuyerFromOCR(ocrText, page1Items);
    const totals = detectTotals(ocrText);

    const invoice_number = extractInvoiceNumber(ocrText);
    const invoiceDate = extractInvoiceDate(ocrText);

    console.log("🧾 ISSUER:", issuer);
    console.log("🧾 INVOICE:", invoice_number);

    const isSale = invoiceType === "sale";

    const parsed: ParsedInternal = {
      issuerRUC: issuer.issuerRUC,

      // ✅ keep issuerName blank for SALES to avoid "Dirección ..." being used as name
      issuerName: isSale ? "" : issuer.issuerName,

      // ✅ ALWAYS return buyer fields (customer info is relevant for both)
      buyerName: buyer.buyerName,
      buyerRUC: buyer.buyerRUC,

      invoiceDate,
      invoice_number,
      concepto: "",

      subtotal15: totals.subtotal15,
      subtotal0: totals.subtotal0,
      iva: totals.iva,
      ice: totals.ice,
      total: totals.total,

      ocr_text: ocrText,
      ocrConfidence: totals.ocrConfidence,
      warnings: [],
    };

    const { lines, warnings } = await buildAccounting(parsed, uid, invoiceType);

    const defaultConcepto =
      parsed.concepto ||
      (invoiceType === "expense"
        ? lines.find((l) => safeNumber(l.debit) > 0)?.accountName
        : "Ingresos por servicios") ||
      "";

    parsed.concepto = defaultConcepto;

    const transactionId = randomUUID();
    const balance = computeBalance(lines);

    const resp: FunctionResponse = {
      success: true,
      invoiceType,

      issuerRUC: parsed.issuerRUC,
      issuerName: parsed.issuerName,

      buyerName: parsed.buyerName,
      buyerRUC: parsed.buyerRUC,

      invoiceDate: parsed.invoiceDate,
      invoice_number: parsed.invoice_number,

      subtotal15: parsed.subtotal15,
      subtotal0: parsed.subtotal0,
      iva: parsed.iva,
      ice: parsed.ice,
      total: parsed.total,

      concepto: parsed.concepto,
      ocr_text: parsed.ocr_text,

      ocrConfidence: parsed.ocrConfidence,
      warnings: [...(parsed.warnings || []), ...(warnings || [])],
      balance,

      entries: (lines || []).map((l) => ({
        id: randomUUID(),
        transactionId,
        account_code: l.accountCode,
        account_name: l.accountName,
        debit: safeNumber(l.debit),
        credit: safeNumber(l.credit),
        issuerRUC: parsed.issuerRUC,
        entityRUC: userRUC,
        source: "vision",
      })),
    };

    return { statusCode: 200, body: JSON.stringify(resp) };
  } catch (err: any) {
    const resp: FunctionResponse = {
      success: false,
      error: err?.message || "Unexpected server error",
    };
    return { statusCode: 500, body: JSON.stringify(resp) };
  }
};