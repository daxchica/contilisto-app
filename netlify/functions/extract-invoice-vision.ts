// ============================================================================
// CONTILISTO — OCR + GPT-4.1 (Versión Final Robusta CORREGIDA)
// Extrae totales directamente del PDF, valida JSON AI,
// devuelve siempre respuesta consistente
// ============================================================================

import { Handler } from "@netlify/functions";
import { OpenAI } from "openai";
import { randomUUID } from "crypto";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import extractJson from "extract-json-from-string";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

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

// ===========================================
// OCR PDF → Texto plano
// ===========================================
async function extractText(data: Uint8Array): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({
    data,
    disableWorker: true,
  } as any);

  const doc = await loadingTask.promise;

  let full = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const txt = await page.getTextContent();
    // Mantenemos todo en una sola "línea lógica"; los patrones
    // trabajarán sobre el texto normalizado completo.
    full += (txt.items as any[])
      .map((x: any) => ` ${x.str ?? ""}`)
      .join("")
      .replace(/\s+/g, " ");
  }

  return full.trim();
}

// ===========================================
// Helper: extraer importe alrededor de una etiqueta
//    - Soporta: "X SUBTOTAL 15%"  o  "SUBTOTAL 15% X"
// ===========================================
function amountFromPatterns(normalized: string, patterns: string[]): number {
  for (const label of patterns) {
    // número ANTES de la etiqueta
    const before = new RegExp(`(\\d+[.,]\\d+)\\s+${label}`);
    let m = normalized.match(before);
    if (m) {
      const val = parseFloat(m[1].replace(",", "."));
      if (!isNaN(val)) return val;
    }

    // número DESPUÉS de la etiqueta
    const after = new RegExp(`${label}\\s*(\\d+[.,]\\d+)`);
    m = normalized.match(after);
    if (m) {
      const val = parseFloat(m[1].replace(",", "."));
      if (!isNaN(val)) return val;
    }
  }
  return 0;
}

// ===========================================
// Detector robusto de totales
//  - NO usa saltos de línea
//  - Ignora "SUBTOTAL SIN IMPUESTOS"
//  - Usa solamente las etiquetas:
//      SUBTOTAL 12/15%, SUBTOTAL 0%,
//      IVA 12/15%, VALOR TOTAL (no SIN SUBSIDIO)
// ===========================================
function detectTotals(text: string) {
  // Normalizamos: un solo espacio y mayúsculas
  const normalized = text.replace(/\s+/g, " ").toUpperCase();

  // SUBTOTAL gravado (12% / 15%)
  const subtotal12 = amountFromPatterns(normalized, [
    "SUBTOTAL\\s+IVA\\s*1[25]%",
    "SUBTOTAL\\s+1[25]%"
  ]);

  // SUBTOTAL 0%
  const subtotal0 = amountFromPatterns(normalized, [
    "SUBTOTAL\\s+0%"
  ]);

  // IVA 12% / 15%
  let iva = amountFromPatterns(normalized, [
    "IVA\\s*1[25]%"
  ]);

  // VALOR TOTAL (pero NO "VALOR TOTAL SIN SUBSIDIO")
  let total = 0;
  let m = normalized.match(/(\d+[.,]\d+)\s+VALOR\s+TOTAL(?!\s+SIN)/);
  if (m) {
    total = parseFloat(m[1].replace(",", "."));
  } else {
    m = normalized.match(/VALOR\s+TOTAL(?!\s+SIN)\s*(\d+[.,]\d+)/);
    if (m) {
      total = parseFloat(m[1].replace(",", "."));
    }
  }

  // Fallback: si no hay IVA explícito pero sí total y bases
  if (iva === 0 && total > 0 && (subtotal12 > 0 || subtotal0 > 0)) {
    const ivaCalc = total - subtotal12 - subtotal0;
    if (ivaCalc > 0) {
      iva = parseFloat(ivaCalc.toFixed(2));
    }
  }

  // Fallback: si no encontramos TOTAL pero sí las 3 partes
  if (total === 0 && (subtotal12 > 0 || subtotal0 > 0 || iva > 0)) {
    total = parseFloat((subtotal12 + subtotal0 + iva).toFixed(2));
  }

  return { subtotal12, subtotal0, iva, total };
}

function detectExpenseCategory(text: string) {
  if (!text || typeof text !== "string") return null;

  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remover acentos
    .replace(/[^a-z0-9\s]/g, " ");   // Limpiar caracteres raros

  const rules = [
    {
      words: ["almu", "comida", "mcdonald", "burguer", "almuerzo", "cafeter", "pollo", "restaurante"],
      accountCode: "502020101",
      name: "Gastos de alimentación"
    },
    {
      words: ["papel", "lapic", "bolig", "tinta", "folder", "carpeta", "cuaderno", "sello"],
      accountCode: "503030501",
      name: "Útiles de oficina"
    },
    {
      words: ["luz", "electricidad", "energia", "agua", "planilla"],
      accountCode: "504020201",
      name: "Servicios básicos"
    },
    {
      words: ["seguro", "poliza", "aseguradora", "prima"],
      accountCode: "503040201",
      name: "Seguros empresariales"
    },
    {
      words: ["publicidad", "marketing", "anuncio", "impresion", "plotter", "banner", "facebook"],
      accountCode: "512020101",
      name: "Gastos de publicidad"
    },
    {
      words: ["gasolina", "diesel", "combustible", "extra"],
      accountCode: "503050301",
      name: "Combustible"
    },
    {
      words: ["internet", "celular", "telefono", "operadora", "plan pospago"],
      accountCode: "504020501",
      name: "Servicios de telefonía"
    },
    {
      words: ["hosting", "dominio", "servidor", "instalacion", "mantenimiento", "reparacion", "consultoria"],
      accountCode: "504070501",
      name: "Servicios profesionales / terceros"
    }
  ];

  for (const rule of rules) {
    if (rule.words.some(w => normalized.indexOf(w) >= 0)) {
      return {
        accountCode: rule.accountCode,
        accountName: rule.name
      };
    }
  }

  return null;
}

// ===========================================
// Construir asiento contable
//  Regla de Dax:
//   Proveedores = SUBTOTAL 12/15 + SUBTOTAL 0 + IVA
// ===========================================
function buildAccounting(entry: ParsedInternal) {
  const lines: any[] = [];

  // Detect category
  const detected = detectExpenseCategory(entry.ocr_text || "");

  const expenseCode = detected?.accountCode ?? "502010101";
  const expenseName = detected?.accountName ?? "Gastos en servicios generales";

  // 1) Base NO gravada
  if (entry.subtotal0 > 0) {
    lines.push({
      accountCode: expenseCode,
      accountName: expenseName,
      debit: entry.subtotal0,
      credit: 0
    });
  }

  // 2) Base gravada (12% / 15%)
  if (entry.subtotal12 > 0) {
    lines.push({
      accountCode: expenseCode,  // ⬅ YA NO HARDCODEADO
      accountName: expenseName,  // ⬅ YA NO HARDCODEADO
      debit: entry.subtotal12,
      credit: 0
    });
  }

  // 3) IVA crédito — solo si hay base gravada y IVA > 0
  if (entry.subtotal12 > 0 && entry.iva > 0) {
    lines.push({
      accountCode: "133010102",
      accountName: "IVA crédito en compras",
      debit: entry.iva,
      credit: 0
    });
  }

  // 4) Proveedores por la SUMA de las 3 partes
  const proveedoresCredit = parseFloat(
    (entry.subtotal12 + entry.subtotal0 + entry.iva).toFixed(2)
  );

  if (proveedoresCredit > 0) {
    lines.push({
      accountCode: "201030102",
      accountName: "Proveedores locales",
      debit: 0,
      credit: proveedoresCredit
    });
  }

  return lines;
}

// ============================================================================
// HANDLER
// ============================================================================
export const handler: Handler = async (event) => {
  try {
    const { base64, userRUC } = JSON.parse(event.body || "{}");
    const safeUserRuc = typeof userRUC === "string" ? userRUC : "";

    if (!base64) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: "Missing PDF" })
      };
    }

    // 1) OCR real
    const uint = new Uint8Array(Buffer.from(base64, "base64"));
    const ocrText = await extractText(uint);

    // 2) Totales desde OCR (empleando reglas nuevas)
    const { subtotal12, subtotal0, iva, total } = detectTotals(ocrText);

    // 3) AI mínima para datos generales de la factura
    const ai = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "user",
          content: `
            Saca del texto EXACTAMENTE estos datos:
            {
            "issuerName": "...",
            "issuerRUC": "...",
            "invoiceDate": "yyyy-mm-dd",
            "invoice_number": "...",
            "concepto": "máximo 6 palabras del detalle"
            }

            Devuelve SOLO JSON sin texto adicional.
            Texto:
            ${ocrText}
`
        }
      ]
    });

    // --------------------------------------
    // Extraemos JSON robusto y sin fallos
    // --------------------------------------

    let enriched: ParsedInternal;

    try {
      const raw = ai.choices[0]?.message?.content || "";
      const extracted = extractJson(raw) || [];
      const parsedAI = extracted[0] || {};

      enriched = {
        issuerRUC: parsedAI.issuerRUC || "",
        issuerName: parsedAI.issuerName || "",
        invoiceDate: parsedAI.invoiceDate || "",
        invoice_number: parsedAI.invoice_number || "",
        concepto: parsedAI.concepto || "",
        subtotal12,
        subtotal0,
        iva,
        total,
        ocr_text: ocrText
      };
    } catch (err) {
      console.log("⚠ AI JSON fallback", err);
      enriched = {
        issuerRUC: "",
        issuerName: "",
        invoiceDate: "",
        invoice_number: "",
        concepto: "",
        subtotal12,
        subtotal0,
        iva,
        total,
        ocr_text: ocrText
      };
    }

    // 4) Construcción de líneas contables
    const lines = buildAccounting(enriched);

    const transactionId = randomUUID();

    const entries = lines.map((acc) => ({
      id: randomUUID(),
      transactionId,

      account_code: acc.accountCode,
      account_name: acc.accountName,
      debit: acc.debit,
      credit: acc.credit,
      
      date: enriched.invoiceDate || new Date().toISOString().slice(0, 10),
      
      description:
        enriched.concepto ||
        (enriched.invoice_number ? `Factura ${enriched.invoice_number}` : ""),
      
        invoice_number: String(enriched.invoice_number || ""),
      issuerRUC: String(enriched.issuerRUC || ""),
      issuerName: String(enriched.issuerName || ""),
      
      entityRUC: userRUC,
      source: "vision",
     
      supplier_name: enriched.issuerName || "",
      status: "pending",
      termDays: 30,
      paymentsCount: 1,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        ...enriched,
        entries
      })
    };
  } catch (error: any) {
    console.log("ERROR_MAIN_HANDLER", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Internal error parsing invoice",
        error: error?.message ?? String(error)
      })
    };
  }
};