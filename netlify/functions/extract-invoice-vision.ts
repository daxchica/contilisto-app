// ============================================================================
// CONTILISTO — OCR + GPT-4.1 (VISION)
// Netlify-safe, robusto, listo para producción
// ============================================================================

import { Handler } from "@netlify/functions";
import { OpenAI } from "openai";
import { randomUUID } from "crypto";
import extractJson from "extract-json-from-string";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface ParsedInternal {
  issuerRUC: string;
  issuerName: string;
  invoiceDate: string;
  invoice_number: string;
  concepto: string;
  subtotal12: number;
  subtotal0: number;
  iva: number;
  total: number;
  ocr_text: string;
}

// ---------------------------------------------------------------------------
// OCR PDF → Texto plano (Netlify SAFE)
// ---------------------------------------------------------------------------

async function extractText(data: Uint8Array): Promise<string> {
  // ⚠️ IMPORT DINÁMICO — OBLIGATORIO PARA NETLIFY
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const loadingTask = pdfjsLib.getDocument({
    data,
    disableWorker: true,
  });

  const doc = await loadingTask.promise;

  let full = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const txt = await page.getTextContent();
    full += (txt.items as any[])
      .map((x: any) => ` ${x.str ?? ""}`)
      .join("")
      .replace(/\s+/g, " ");
  }

  return full.trim();
}

// ---------------------------------------------------------------------------
// HELPERS — Totales
// ---------------------------------------------------------------------------

function amountFromPatterns(normalized: string, patterns: string[]): number {
  for (const label of patterns) {
    const before = new RegExp(`(\\d+[.,]\\d+)\\s+${label}`);
    let m = normalized.match(before);
    if (m) {
      const v = parseFloat(m[1].replace(",", "."));
      if (!isNaN(v)) return v;
    }

    const after = new RegExp(`${label}\\s*(\\d+[.,]\\d+)`);
    m = normalized.match(after);
    if (m) {
      const v = parseFloat(m[1].replace(",", "."));
      if (!isNaN(v)) return v;
    }
  }
  return 0;
}

function detectTotals(text: string) {
  const normalized = text.replace(/\s+/g, " ").toUpperCase();

  const subtotal12 = amountFromPatterns(normalized, [
    "SUBTOTAL\\s+IVA\\s*1[25]%",
    "SUBTOTAL\\s+1[25]%",
  ]);

  const subtotal0 = amountFromPatterns(normalized, ["SUBTOTAL\\s+0%"]);

  let iva = amountFromPatterns(normalized, ["IVA\\s*1[25]%"]);

  let total = 0;
  let m = normalized.match(/(\d+[.,]\d+)\s+VALOR\s+TOTAL(?!\s+SIN)/);
  if (!m) {
    m = normalized.match(/VALOR\s+TOTAL(?!\s+SIN)\s*(\d+[.,]\d+)/);
  }
  if (m) total = parseFloat(m[1].replace(",", "."));

  if (iva === 0 && total > 0) {
    const calc = total - subtotal12 - subtotal0;
    if (calc > 0) iva = parseFloat(calc.toFixed(2));
  }

  if (total === 0 && (subtotal12 || subtotal0 || iva)) {
    total = parseFloat((subtotal12 + subtotal0 + iva).toFixed(2));
  }

  return { subtotal12, subtotal0, iva, total };
}

// ---------------------------------------------------------------------------
// CATEGORIZACIÓN SIMPLE DE GASTO
// ---------------------------------------------------------------------------

function detectExpenseCategory(text: string) {
  const n = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");

  const rules = [
    { w: ["almuerzo", "comida", "restaurante"], c: "502020101", n: "Gastos de alimentación" },
    { w: ["papel", "tinta", "lapic"], c: "503030501", n: "Útiles de oficina" },
    { w: ["luz", "agua", "energia"], c: "504020201", n: "Servicios básicos" },
    { w: ["seguro", "poliza"], c: "503040201", n: "Seguros empresariales" },
    { w: ["publicidad", "facebook"], c: "512020101", n: "Gastos de publicidad" },
    { w: ["gasolina", "diesel"], c: "503050301", n: "Combustible" },
    { w: ["internet", "telefono"], c: "504020501", n: "Servicios de telefonía" },
  ];

  for (const r of rules) {
    if (r.w.some((x) => n.includes(x))) {
      return { accountCode: r.c, accountName: r.n };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// ASIENTO CONTABLE
// ---------------------------------------------------------------------------

function buildAccounting(entry: ParsedInternal) {
  const lines: any[] = [];

  const detected = detectExpenseCategory(entry.ocr_text || "");
  const expenseCode = detected?.accountCode ?? "502010101";
  const expenseName = detected?.accountName ?? "Gastos en servicios generales";

  if (entry.subtotal0 > 0) {
    lines.push({ accountCode: expenseCode, accountName: expenseName, debit: entry.subtotal0, credit: 0 });
  }

  if (entry.subtotal12 > 0) {
    lines.push({ accountCode: expenseCode, accountName: expenseName, debit: entry.subtotal12, credit: 0 });
  }

  if (entry.subtotal12 > 0 && entry.iva > 0) {
    lines.push({ accountCode: "133010102", accountName: "IVA crédito en compras", debit: entry.iva, credit: 0 });
  }

  const total = parseFloat((entry.subtotal12 + entry.subtotal0 + entry.iva).toFixed(2));
  if (total > 0) {
    lines.push({ accountCode: "201030102", accountName: "Proveedores locales", debit: 0, credit: total });
  }

  return lines;
}

// ---------------------------------------------------------------------------
// HANDLER
// ---------------------------------------------------------------------------

export const handler: Handler = async (event) => {
  try {
    const { base64, userRUC } = JSON.parse(event.body || "{}");
    const safeUserRuc = typeof userRUC === "string" ? userRUC : "";

    if (!base64) {
      return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: false }) };
    }

    const uint = new Uint8Array(Buffer.from(base64, "base64"));
    const ocrText = await extractText(uint);

    const { subtotal12, subtotal0, iva, total } = detectTotals(ocrText);

    // 🔒 LIMITAR TEXTO PARA GPT
    const aiText = ocrText.slice(0, 6000);

    const ai = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "user",
          content: `
Extrae SOLO este JSON:
{
 "issuerName":"",
 "issuerRUC":"",
 "invoiceDate":"yyyy-mm-dd",
 "invoice_number":"",
 "concepto":"max 6 palabras"
}
Texto:
${aiText}
`,
        },
      ],
    });

    const raw = ai.choices[0]?.message?.content || "";
    const extracted = extractJson(raw) || [];
    const p = extracted[0] || {};
    const s = (v: any) => (typeof v === "string" ? v.trim() : "");

    const enriched: ParsedInternal = {
      issuerRUC: s(p.issuerRUC),
      issuerName: s(p.issuerName),
      invoiceDate: s(p.invoiceDate),
      invoice_number: s(p.invoice_number),
      concepto: s(p.concepto),
      subtotal12,
      subtotal0,
      iva,
      total,
      ocr_text: ocrText,
    };

    const transactionId = randomUUID();
    const lines = buildAccounting(enriched);

    const entries = lines.map((l) => ({
      id: randomUUID(),
      transactionId,
      account_code: l.accountCode,
      account_name: l.accountName,
      debit: l.debit,
      credit: l.credit,
      date: enriched.invoiceDate || new Date().toISOString().slice(0, 10),
      description: enriched.concepto || `Factura ${enriched.invoice_number}`,
      invoice_number: enriched.invoice_number,
      issuerRUC: enriched.issuerRUC,
      issuerName: enriched.issuerName,
      entityRUC: safeUserRuc,
      source: "vision",
      supplier_name: enriched.issuerName,
      status: "pending",
      termDays: 30,
      paymentsCount: 1,
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, ...enriched, entries }),
    };
  } catch (err: any) {
    console.error("VISION_HANDLER_ERROR", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: err?.message || "Internal error" }),
    };
  }
};