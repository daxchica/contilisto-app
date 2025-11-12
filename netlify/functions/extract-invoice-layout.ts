// netlify/functions/extract-invoice-layout.ts
import { Handler } from "@netlify/functions";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 🧠 Prompt principal
 */
const ACCOUNTING_PROMPT = `
Eres un contador ecuatoriano experto en análisis visual de facturas SRI (Ecuador).

OBJETIVO:
Analizar bloques OCR extraídos de un PDF para generar asientos contables balanceados en formato JSON,
siguiendo el Plan Único de Cuentas (PUC) del Ecuador.

INSTRUCCIONES:
1️⃣ Usa los bloques con palabras como "RUC", "FACTURA", "SUBTOTAL", "IVA", "TOTAL", "FORMA DE PAGO", etc.
2️⃣ Si detectas "SUBTOTAL 15%", "IVA 15%", o "IVA 12%", calcula IVA = 0.15 * subtotal15%.
3️⃣ Si hay "SUBTOTAL 0%", trátalo como base no gravada (no genera IVA).
4️⃣ Si el texto incluye "VALOR TOTAL" o "TOTAL A PAGAR", úsalo como monto final.
5️⃣ Determina si es COMPRA (expense) o VENTA (income):
   - Si el RUC emisor es distinto al del usuario → COMPRA
   - Si coincide → VENTA
6️⃣ Para COMPRAS:
   - Débito 1: Gasto según descripción (usa IA para asignar cuenta)
   - Débito 2: IVA crédito tributario (24301) si existe IVA
   - Crédito: Proveedores (201030102) o Caja/Bancos (según texto "efectivo", "transferencia")
7️⃣ Para VENTAS:
   - Crédito 1: Ingreso (70101)
   - Crédito 2: IVA débito tributario (24302)
   - Débito: Cuentas por cobrar o Bancos
8️⃣ Si la factura no tiene IVA, omite la cuenta de IVA.
9️⃣ Usa máximo 4 líneas, siempre cuadradas (débitos = créditos).

CUENTAS COMUNES:
- 60601 INSUMOS DE PRODUCCIÓN
- 60401 SUMINISTROS Y MATERIALES
- 61301 ALIMENTOS Y BEBIDAS
- 60402 LIMPIEZA Y DESINFECCIÓN
- 24301 IVA CRÉDITO TRIBUTARIO
- 24302 IVA DÉBITO TRIBUTARIO
- 201030102 PROVEEDORES
- 11101 CAJA
- 11201 BANCOS

MAPEO AUTOMÁTICO POR DESCRIPCIÓN:
- Si el texto contiene “ATÚN”, “ARROZ”, “GALAK”, “PIERNA”, “LECHE”, “CAFÉ” → 61301 ALIMENTOS Y BEBIDAS
- Si contiene “CLORO”, “DETERGENTE”, “JABÓN”, “LIMPIEZA” → 60402 LIMPIEZA Y DESINFECCIÓN
- Si contiene “REPUESTO”, “ACEITE”, “TORNILLO”, “TUBO”, “VALVULA” → 60601 INSUMOS DE PRODUCCIÓN
- Si no encaja, usa 50999 OTROS GASTOS

SALIDA JSON (válido y balanceado, sin explicaciones):

[
  {
    "date": "2025-04-04",
    "account_code": "61301",
    "account_name": "Alimentos y bebidas",
    "description": "Compra supermercado El Rosado",
    "debit": 5.19,
    "credit": null,
    "type": "expense",
    "invoice_number": "262-201-000095179"
  },
  {
    "account_code": "24301",
    "account_name": "IVA crédito tributario",
    "description": "IVA 15%",
    "debit": 0.04,
    "credit": null,
    "type": "expense"
  },
  {
    "account_code": "201030102",
    "account_name": "Proveedores",
    "description": "Factura El Rosado",
    "debit": null,
    "credit": 5.23,
    "type": "expense"
  }
]
`.trim();

/**
 * Filtra solo los bloques relevantes
 */
function filterVisualBlocks(blocks: any[]): any[] {
  return blocks.filter((b) =>
    /ruc|factura|autorizaci[oó]n|subtotal|iva|total|proveedor|cliente|forma de pago|efectivo|transferencia|valor total/i.test(
      b.text?.toLowerCase() ?? ""
    )
  );
}

/**
 * Convierte el layout a un string visual
 */
function buildVisualPrompt(blocks: any[]): string {
  return blocks
    .map(
      (b) =>
        `[Page ${b.page}] (${b.x},${b.y},${b.width},${b.height}) → ${b.text}`
    )
    .join("\n");
}

/**
 * Limpia respuesta GPT para extraer solo el JSON
 */
function cleanResponse(raw: string): string {
  return raw
    .replace(/```json/i, "")
    .replace(/```/g, "")
    .replace(/^.*?\[/s, "[") // keep from first “[”
    .replace(/\][\s\S]*$/, "]") // keep until last “]”
    .replace(/,\s*([\]}])/g, "$1") // remove trailing commas
    .replace(/\r?\n|\r/g, "")
    .trim();
}

/**
 * Función principal
 */
const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { blocks, userRUC } = JSON.parse(event.body || "{}");

    if (!Array.isArray(blocks) || typeof userRUC !== "string") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing blocks or userRUC" }),
      };
    }

    const filtered = filterVisualBlocks(blocks);
    const today = new Date().toISOString().slice(0, 10);

    const userPrompt = `
RUC de la empresa contable: ${userRUC}
Fecha actual: ${today}

Bloques visuales extraídos del PDF:
${buildVisualPrompt(filtered)}
`.trim();

    console.log("📤 Enviando LayoutAI a OpenAI...");
    console.log("🔹 Bloques:", filtered.length);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        { role: "system", content: ACCOUNTING_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = response.choices?.[0]?.message?.content ?? "";
    console.log("🧠 Raw GPT output (first 300 chars):", raw.slice(0, 300));

    const cleaned = cleanResponse(raw);
    console.log("🧹 Cleaned GPT output (first 300 chars):", cleaned.slice(0, 300));

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error("Expected JSON array");
    } catch (parseError) {
      console.error("❌ JSON parse error (LayoutAI):", parseError);
      console.error("🧾 RAW snippet:", raw.slice(0, 600));
      console.error("🧼 CLEANED snippet:", cleaned.slice(0, 600));
      return {
        statusCode: 422,
        body: JSON.stringify({
          error: "Invalid JSON from OpenAI",
          rawSnippet: raw.slice(0, 600),
        }),
      };
    }

    console.log(`✅ LayoutAI parsed ${parsed.length} entries`);
    return {
      statusCode: 200,
      body: JSON.stringify(parsed),
    };
  } catch (error: any) {
    console.error("❌ Internal Error (LayoutAI):", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal Server Error",
        message: error.message,
      }),
    };
  }
};

export { handler };