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

  subtotal12: number;
  subtotal0: number;
  iva: number;
  ice: number;
  total: number;

  ocr_text: string;
  ocrConfidence?: any;
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

  issuerRUC?: string;
  issuerName?: string;

  buyerName?: string;
  buyerRUC?: string;

  invoiceDate?: string;
  invoice_number?: string;

  subtotal12?: number;
  subtotal0?: number;
  iva?: number;
  ice?: number;
  total?: number;

  concepto?: string;
  ocr_text?: string;

  entries?: any[];
  warnings?: string[];
  balance?: any;
  ocrConfidence?: any;
  error?: string;
};

// ---------------------------------------------------------------------------
// OCR EXTRACTION (PDF.js)
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
  }).promise;

  let text = "";
  let page1Items: TextItemLite[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    content.items.forEach((it: any) => {
      text += ` ${it.str || ""}`;
    });

    if (i === 1) {
      page1Items = content.items
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
    }
  }

  return {
    text: text.replace(/\s+/g, " ").trim(),
    page1Items,
  };
}

function detectTotalsFromLayout(items: TextItemLite[]) {
  if (!items || items.length === 0) {
    return { subtotal12: 0, subtotal0: 0, iva: 0, ice: 0, total: 0 };
  }

  // Área 5: 30% inferior del documento
  const ys = items.map(i => i.y);
  const maxY = Math.max(...ys);
  const minY = Math.min(...ys);

  const area5Bottom = minY + (maxY - minY) * 0.30;

  const area5Items = items.filter(i => i.y <= area5Bottom);

  // Detectar columna derecha (valores)
  const xs = area5Items.map(i => i.x);
  const rightX = Math.max(...xs);

  // Valores cerca del margen derecho
  const valueItems = area5Items
    .filter(i => Math.abs(i.x - rightX) < 15)
    .map(i => i.str.trim())
    .filter(s => /\d+[.,]\d{2}$/.test(s))   // cents required
    .filter(s => s.length <= 12)            // exclude keys
    .map(parseMoney)
    .filter(v => v > 0);

  // Heurística SRI típica:
  // [subtotal12?, subtotal0?, iva?, total]
  let subtotal12 = 0;
  let subtotal0 = 0;
  let iva = 0;
  let total = 0;

  if (valueItems.length >= 2) {
  total = valueItems[valueItems.length - 1];

  // Heuristic: IVA is usually the closest value below TOTAL
    const candidatesBelowTotal = valueItems
      .slice(0, -1)
      .filter(v => v < total);

    iva = candidatesBelowTotal.length
      ? candidatesBelowTotal[candidatesBelowTotal.length - 1]
      : 0;

    const base = total - iva;
    subtotal12 = Number(base.toFixed(2));

    if (subtotal12 > total) {
      subtotal12 = 0;
    }
  }

  if (subtotal12 < 0 || iva < 0 || total <= 0) {
    return { subtotal12: 0, subtotal0: 0, iva: 0, ice: 0, total: 0 };
  }

return { subtotal12, subtotal0, iva, ice: 0, total };
}


// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const cleanRuc = (v: string) => (v || "").replace(/\D/g, "");
const safeNumber = (n: any) => (Number.isFinite(+n) ? +n : 0);

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

/** Money parser */
function parseMoney(raw: string): number {
  if (!raw) return 0;
  // Remove extra spaces
  const v = raw.trim();
  // If both separators exist, assume "." thousands and "," decimals
  if (v.includes(".") && v.includes(",")) {
    return safeNumber(v.replace(/\./g, "").replace(",", "."));
  }
  return safeNumber(v.replace(",", "."));
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

function buildLines(items: TextItemLite[], yTol = 3) {
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(b.y - a.y) > yTol) return b.y - a.y; // top to bottom (higher y first)
    return a.x - b.x; // left to right
  });

  type Line = { y: number; x0: number; x1: number; text: string };
  const lines: { y: number; parts: TextItemLite[] }[] = [];

  for (const it of sorted) {
    const target = lines.find((l) => Math.abs(l.y - it.y) <= yTol);
    if (target) {
      target.parts.push(it);
      // Keep representative y as average
      target.y = (target.y + it.y) / 2;
    } else {
      lines.push({ y: it.y, parts: [it] });
    }
  }

  const out: Line[] = lines
    .map((l) => {
      const parts = [...l.parts].sort((a, b) => a.x - b.x);
      const rawText = parts.map((p) => p.str).join(" ").replace(/\s+/g, " ").trim();
      const text = normalizeSpacedCaps(rawText);
      const x0 = Math.min(...parts.map((p) => p.x));
      const x1 = Math.max(...parts.map((p) => p.x + (p.w || 0)));
      return { y: l.y, x0, x1, text };
    })
    .sort((a, b) => {
      if (Math.abs(b.y - a.y) > yTol) return b.y - a.y;
      return a.x0 - b.x0;
    });

  return out;
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
  if (u.includes("NUMERO DE AUTORIZACION")) return true;
  if (u.includes("NÚMERO DE AUTORIZACIÓN")) return true;
  if (u.includes("AUTORIZACION")) return true;
  if (u.includes("FACTURA")) return true;
  if (u.startsWith("RUC") || u.startsWith("R.U.C")) return true;
  if (u.includes("AMBIENTE") || u.includes("EMISION") || u.includes("EMISIÓN")) return true;
  if (u.includes("OBLIGADO") || u.includes("CONTABILIDAD")) return true;
  

  // Common labels that are not issuer name
  if (u.startsWith("FECHA") || u.includes("FECHA Y HORA")) return true;
  if (u.includes("AGENTE DE RETENCION") || u.includes("AGENTE DE RETENCIÓN")) return true;
  if (u.includes("RESOLUCION")) return true;

  return false;
}

function extractIssuerNameFromLayout(page1Items: TextItemLite[]): string {
  if (!page1Items || page1Items.length === 0) return "";

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
  const candidates = lines.filter(l =>
    l.y >= topLimit &&
    l.x0 <= leftLimit
  );

  console.log("ISSUER CANDIDATES:", candidates.map(c => c.text));

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

function extractBuyerFromLayout(page1Items: TextItemLite[]) {
  const lines = buildLines(page1Items);

  let buyerName = "";
  let buyerRUC = "";

  // We only accept Cuadro 3 anchors (SRI standard)
  const anchorRe =
    /RAZ[ÓO]N\s+SOCIAL\s*\/\s*NOMBRES?\s+Y\s+APELLIDOS/i;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].text.trim();
    if (!raw) continue;

    if (!anchorRe.test(raw)) continue;

    // Extract name from anchor line
    // Example:
    // "RAZÓN SOCIAL / NOMBRES Y APELLIDOS: AGENSITUR SA RUC / CI : 0991516166001"
    buyerName = raw
      .replace(anchorRe, "")
      .replace(/^[:\-\s]+/, "")
      .replace(/\s+RUC\s*\/\s*CI\s*[:\-]?\s*\d{10,13}.*$/i, "")
      .trim();

    // Now find buyer RUC near this block (same line or next 1-3 lines)
    const lookahead = lines.slice(i, i + 4).map((l) => l.text).join(" ");
    const rucMatch =
      lookahead.match(/\bRUC\s*\/\s*CI\s*[:\-]?\s*(\d{10,13})\b/i) ||
      lookahead.match(/\b(\d{13})\b/); // fallback if label omitted but 13-digit present

    buyerRUC = cleanRuc(rucMatch?.[1] ?? "");

    // Hard safety: do not accept tiny garbage names like "FACTURA"
    if (buyerName && buyerName.toUpperCase() !== "FACTURA") {
      return { buyerName, buyerRUC };
    }

    // If name invalid, still allow a retry with OCR later
    buyerName = "";
    buyerRUC = "";
  }

  return { buyerName: "", buyerRUC: "" };
}

function extractIssuerRUCFromText(text: string): string {
  const clean = (text || "").replace(/\s+/g, " ");

  // Prefer explicit "RUC: 13 digits"
  const explicit =
    clean.match(/\bR\s*\.?\s*U\s*\.?\s*C\s*[:\-]?\s*(\d{13})\b/i)?.[1] ?? "";

  if (explicit) return explicit;

  // Fallback: first 13-digit sequence (works if RUC appears early)
  const head = clean.slice(0, 500);
  const any13 = clean.match(/\b(\d{13})\b/)?.[1] ?? "";
  return any13;
}

// ---------------------------------------------------------------------------
// BUYER (kept, but not used to determine invoice type)
// ---------------------------------------------------------------------------

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
  // Layout first
  const fromLayout = items.find((i) =>
    /\b\d{3}-\d{3}-\d{6,}\b/.test(i.str.replace(/\s+/g, ""))
  );
  if (fromLayout) return fromLayout.str.replace(/\s+/g, "");

  // OCR fallback
  const m = (text || "").match(/\b\d{3}-\d{3}-\d{6,}\b/);
  return m?.[0] ?? "";
}

function extractInvoiceDate(text: string, items: TextItemLite[]) {
  // Accept date with optional time, but return only the date part
  const dateRe = /\b\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}:\d{2})?\b/;

  const fromLayout = items.find((i) => dateRe.test(i.str));
  if (fromLayout) return fromLayout.str.trim().slice(0, 10);

  const m = (text || "").match(dateRe);
  return (m?.[0] ?? "").slice(0, 10);
}

// ---------------------------------------------------------------------------
// TOTALS (SAFE: avoid authorization keys by requiring cents)
// ---------------------------------------------------------------------------

const MONEY = "([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})";

function pickMoney(text: string, re: RegExp): number {
  const m = (text || "").match(re);
  return parseMoney(m?.[1] ?? "");
}

// ⚠️ OCR fallback ONLY — unreliable for SRI totals
function detectTotals(text: string) {
  const t = (text || "").replace(/\s+/g, " ").toUpperCase();

  const subtotal12 =
    pickMoney(t, new RegExp(`SUBTOTAL\\s*(?:12|15)\\s*%?[\\s\\S]{0,30}?${MONEY}`)) ||
    pickMoney(t, new RegExp(`BASE\\s*IMPONIBLE\\s*(?:12|15)\\s*%?\\s*${MONEY}`)) ||
    0;

  const subtotal0 =
    pickMoney(t, new RegExp(`SUBTOTAL\\s*0\\s*%?\\s*${MONEY}`)) ||
    pickMoney(t, new RegExp(`EXENTO\\s*DE\\s*IVA\\s*${MONEY}`)) ||
    0;

  const iva =
    pickMoney(t, new RegExp(`IVA\\s*(?:12|15)\\s*%?[\\s\\S]{0,20}?${MONEY}`)) ||
    pickMoney(t, new RegExp(`I\\.?V\\.?A\\.?\\s*(?:12|15)?\\s*%?[\\s\\S]{0,20}?${MONEY}`)) ||
    0;

  // Prefer "VALOR TOTAL" (SRI summary)
  let total =
    pickMoney(t, new RegExp(`VALOR\\s*TOTAL\\s*${MONEY}`)) ||
    pickMoney(t, new RegExp(`TOTAL\\s*${MONEY}`));

  // Fallback computed if missing
  if (!total && (subtotal12 || subtotal0 || iva)) {
    total = safeNumber(subtotal12 + subtotal0 + iva);
  }
  
  // 🔒 ECUADOR SRI SAFETY: total must include IVA if IVA exists
  const computedTotal = safeNumber(subtotal12 + subtotal0 + iva);

  if (iva > 0 && Math.abs(total - computedTotal) > 0.02) {
    total = computedTotal;
  }

  return { subtotal12, subtotal0, iva, ice: 0, total };
}



// ---------------------------------------------------------------------------
// ACCOUNTING (NO CAMBIOS) — includes AP line for expenses always
// ---------------------------------------------------------------------------

async function buildAccounting(
  entry: ParsedInternal,
  uid: string,
  invoiceType: "sale" | "expense"
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

    lines.push({
      accountCode: "401010101",
      accountName: "Ingresos por servicios",
      debit: 0,
      credit: safeNumber(entry.subtotal12 + entry.subtotal0),
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

  // Expense base Gasto SIN IVA (NIIF / SRI)
  lines.push({
    accountCode: expenseCode,
    accountName: expenseName,
    debit: safeNumber(entry.total - entry.iva - entry.ice),
    credit: 0,
  });

  // IVA crédito compras
  if (entry.iva > 0) {
    lines.push({
      accountCode: "133010102",
      accountName: "IVA crédito en compras",
      debit: safeNumber(entry.iva),
      credit: 0,
    });
  }

  // AP (always)
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
    const { text, page1Items } = await extractText(buffer);

    // ✅ Issuer name: LEFT margin, Cuadro 1
    const issuerName = extractIssuerNameFromLayout(page1Items);

    // ✅ Issuer RUC: from OCR text
    const issuerRUC = extractIssuerRUCFromText(text);

    if (!issuerRUC) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          error: "No se pudo detectar el RUC del emisor.",
          ocr_text: text,
        } satisfies FunctionResponse),
      };
    }

    const invoiceType = determineInvoiceType(issuerRUC, userRUC);

    let buyerName = "";
    let buyerRUC = "";

    // ✅ Only SALES need "Cliente" from Cuadro 3
    if (invoiceType === "sale") {
      const fromLayout = extractBuyerFromLayout(page1Items);
      buyerName = fromLayout.buyerName;
      buyerRUC = fromLayout.buyerRUC;

      // fallback OCR only if layout fails
      if (!buyerName || buyerName.toUpperCase() === "FACTURA") {
        const fromOCR = extractBuyerFromOCR(text);
        buyerName = buyerName || fromOCR.buyerName;
        buyerRUC = buyerRUC || fromOCR.buyerRUC;
      }
    }

    let totals = detectTotalsFromLayout(page1Items);

    if (!totals.total || totals.total === 0) {
      totals = detectTotals(text);
    }

    const parsed: ParsedInternal = {
      issuerRUC,
      issuerName: issuerName || "",

      buyerName,
      buyerRUC,

      invoice_number: extractInvoiceNumber(text, page1Items),
      invoiceDate: extractInvoiceDate(text, page1Items),
      concepto: "",

      subtotal12: totals.subtotal12,
      subtotal0: totals.subtotal0,
      iva: totals.iva,
      ice: totals.ice,
      total: totals.total,

      ocr_text: text,
    };

    // ✅ EXPENSE CONTEXT (SAFE)
    if (invoiceType === "expense") {
      const ctx = extractExpenseContextFromItems(page1Items, text);
      if (ctx?.concepto) parsed.concepto = ctx.concepto;
    }

    // ✅ Critical fallback for description
    parsed.concepto =
      parsed.concepto ||
      parsed.invoice_number ||
      "Gasto sin descripción";

    const { lines, warnings } = await buildAccounting(parsed, uid, invoiceType);

    const transactionId = randomUUID();
    const balance = {
      debit: Number(lines.reduce((s, l) => s + safeNumber(l.debit), 0).toFixed(2)),
      credit: Number(lines.reduce((s, l) => s + safeNumber(l.credit), 0).toFixed(2)),
    };

    if (Math.abs(balance.debit - balance.credit) > 0.01) {
      warnings.push("Asiento desbalanceado detectado en backend");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        invoiceType,

        issuerRUC: parsed.issuerRUC,
        issuerName: parsed.issuerName,

        buyerName: parsed.buyerName,
        buyerRUC: parsed.buyerRUC,

        invoice_number: parsed.invoice_number,
        invoiceDate: parsed.invoiceDate,

        subtotal12: parsed.subtotal12,
        subtotal0: parsed.subtotal0,
        iva: parsed.iva,
        total: parsed.total,

        concepto: parsed.concepto,
        ocr_text: parsed.ocr_text,

        warnings: warnings?.length ? warnings : undefined,
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