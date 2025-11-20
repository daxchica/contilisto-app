// ============================================================================
// CONTILISTO — OCR + GPT-4.1 (OpenAI 6.9.1)
// Arquitectura C — pdfjs-dist (sin canvas, sin DOM)
// 100% compatible con Netlify
// ============================================================================

import { Handler } from "@netlify/functions";
import { OpenAI } from "openai";
import { randomUUID } from "crypto";
import { ACCOUNTING_PROMPT } from "../prompts/accountingPoliciesPrompt";

// ---------------------------------------------------------------------------
// PDFJS (modo legacy compatible con Node + Netlify)
// ---------------------------------------------------------------------------
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve(
  "pdfjs-dist/legacy/build/pdf.worker.js"
);

// ---------------------------------------------------------------------------
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
interface RecommendedAccount {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

interface InvoiceAIResponse {
  issuerRUC: string;
  issuerName: string;
  buyerRUC?: string;
  buyerName?: string;
  invoiceDate: string;
  invoice_number: string;
  subtotal12: number;
  subtotal0: number;
  iva: number;
  total: number;
  concepto: string;
  type: string;
  recommendedAccounts: RecommendedAccount[];
  ocr_text: string;
}

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------
function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

async function extractText(data: Uint8Array): Promise<string> {
  const pdf = await pdfjsLib
    .getDocument({ data, useSystemFonts: true, verbosity: 0 })
    .promise;

  let fullText = "";

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const cont = await page.getTextContent();
    const text = cont.items.map((it: any) => it.str ?? "").join(" ");
    fullText += text + "\n\n";
  }

  return fullText.trim();
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================
export const handler: Handler = async (event) => {
  try {
    if (!event.body)
      return { statusCode: 400, body: "Missing body" };

    const { base64, userRUC, entityType } = JSON.parse(event.body);

    if (!base64)
      return { statusCode: 400, body: "Missing base64" };

    const finalType =
      entityType && typeof entityType === "string"
        ? entityType.trim()
        : "servicios";

    // 1) Convertir PDF
    const pdfData = base64ToUint8Array(base64);

    // 2) Extraer OCR
    const ocrText = await extractText(pdfData);

    // 3) Construir prompt
    const prompt = `
Eres un experto contable ecuatoriano. Procesa el texto OCR de una factura.

${ACCOUNTING_PROMPT.replace("{{entityType}}", finalType)}

TEXTO OCR:
-------------------
${ocrText}
    `.trim();

    // 4) GPT-4.1 — Schema JSON VALIDADO
    // -----------------------------------------------
    const completion = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "invoice_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              issuerRUC: { type: "string" },
              issuerName: { type: "string" },
              buyerRUC: { type: "string" },
              buyerName: { type: "string" },
              invoiceDate: { type: "string" },
              invoice_number: { type: "string" },
              subtotal12: { type: "number" },
              subtotal0: { type: "number" },
              iva: { type: "number" },
              total: { type: "number" },
              concepto: { type: "string" },
              type: { type: "string" },

              // *** FIX: recommendedAccounts definido correctamente ***
              recommendedAccounts: {
                type: "array",
                additionalProperties: false,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    accountCode: { type: "string" },
                    accountName: { type: "string" },
                    debit: { type: "number" },
                    credit: { type: "number" },
                  },
                  required: ["accountCode", "accountName"],
                },
              },

              ocr_text: { type: "string" },
            },

            required: [
              "issuerRUC",
              "issuerName",
              "invoiceDate",
              "invoice_number",
              "total",
              "recommendedAccounts",
              "ocr_text",
            ],
          },
        },
      },
    });

    const parsed = JSON.parse(completion.choices[0].message.content!) as InvoiceAIResponse;

    // 5) Transformar en asientos contables
    const entries = parsed.recommendedAccounts.map((acc) => ({
      id: randomUUID(),
      account_code: acc.accountCode,
      account_name: acc.accountName,
      debit: acc.debit ?? 0,
      credit: acc.credit ?? 0,
      date: parsed.invoiceDate,
      description: parsed.concepto ?? "",
      invoice_number: parsed.invoice_number,
      issuerRUC: parsed.issuerRUC,
      issuerName: parsed.issuerName,
      entityRUC: parsed.buyerRUC || userRUC,
      type: parsed.type ?? "expense",
      source: "vision" as const,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        ...parsed,
        entries,
      }),
    };
  } catch (err: any) {
    console.error("❌ ERROR extract-invoice-vision:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: err.message,
        stack: err.stack,
      }),
    };
  }
};