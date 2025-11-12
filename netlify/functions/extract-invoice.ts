// netlify/functions/extract-invoice.ts
import { Handler } from "@netlify/functions";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Prompt mejorado y más específico
 */
const ACCOUNTING_PROMPT = `
Eres un contador ecuatoriano experto en facturación electrónica SRI.

OBJETIVO:
Interpretar el texto OCR completo de una factura (sin formato). 
Identificar sus totales, subtotales, IVA, forma de pago y generar asientos contables balanceados segun el Plan Unico de Cuentas (PUC) del Ecuador.

INSTRUCCIONES DETALLADAS:
1️⃣ Identifica el RUC del emisor y el número de factura.
2️⃣ Busca los valores de:
   - "SUBTOTAL 15%" o "SUBTOTAL IVA 15%"
   - "SUBTOTAL 0%" o "SUBTOTAL NO OBJETO DE IVA"
   - "IVA 15%" o "IVA 12%"
   - "VALOR TOTAL" o "TOTAL A PAGAR"
3️⃣ Si solo aparece "SUBTOTAL SIN IMPUESTOS", trátalo como base 0 % + 15 %.
4️⃣ Detecta la forma de pago ("EFECTIVO", "TRANSFERENCIA", "TARJETA", "CRÉDITO").
5️⃣ Determina si es COMPRA (expense) o VENTA (income) comparando el RUC del emisor con el del usuario.
6️⃣ Para COMPRAS:
   - Débito 1: Gasto (detecta la cuenta según descripción)
   - Débito 2: IVA crédito tributario (1010501) si aplica
   - Crédito : Proveedores (201030102) o Caja/Bancos según forma de pago
7️⃣ Para VENTAS:
   - Crédito 1: Ingreso (70101)
   - Crédito 2: IVA débito tributario (24302)
   - Débito  : Cuentas por cobrar o Bancos
8️⃣ Usa máximo 4 líneas; los débitos y créditos deben cuadrar.
9️⃣ Si no se menciona IVA, omite esa línea.
🔟 Todos los registros deben ser de cuentas de nivel 5 cuando existan.

MAPEO AUTOMÁTICO POR DESCRIPCIÓN:
- Si el texto contiene “ATÚN”, “ARROZ”, “GALAK”, “PIERNA”, “LECHE”, “CAFÉ” → 61301 ALIMENTOS Y BEBIDAS  
- “CLORO”, “DETERGENTE”, “JABÓN”, “LIMPIEZA” → 60402 LIMPIEZA Y DESINFECCIÓN  
- “REPUESTO”, “ACEITE”, “TORNILLO”, “TUBO”, “VÁLVULA” → 60601 INSUMOS DE PRODUCCIÓN  
- De lo contrario → 50999 OTROS GASTOS

FORMATO JSON (válido, sin explicaciones):

[
  {
    "date": "YYYY-MM-DD",
    "account_code": "61301",
    "account_name": "Alimentos y bebidas",
    "description": "Compra supermercado El Rosado",
    "debit": 5.19,
    "credit": null,
    "type": "expense",
    "invoice_number": "262-201-000095179"
  },
  {
    "account_code": "1010501",
    "account_name": "CRÉDITO TRIBUTARIO A FAVOR DE LA EMPRESA (IVA)",
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
 * Interfaz para el resultado esperado
 */
interface JournalEntryRaw {
  date: string;
  account_code: string;
  account_name: string;
  description: string;
  debit: number | null;
  credit: number | null;
  type: "expense" | "income";
  invoice_number?: string;
  issuerRUC?: string;
}

/**
 * Limpieza robusta del JSON
 */
function cleanJSONResponse(raw: string): string {
  console.log("🧹 Limpiando respuesta GPT...");
  let cleaned = raw.trim();
  // Remover markdown
  cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  
  // Remover texto antes del primer [
  const firstBracket = cleaned.indexOf("[");
  if (firstBracket > 0) {
    console.log(`⚠️ Removiendo ${firstBracket} caracteres antes del JSON`);
    cleaned = cleaned.substring(firstBracket);
  }
  // Remover texto después del último ]
  const lastBracket = cleaned.lastIndexOf("]");
  if (lastBracket !== -1 && lastBracket < cleaned.length - 1) {
    console.log(`⚠️ Removiendo ${cleaned.length - lastBracket - 1} caracteres después del JSON`);
    cleaned = cleaned.substring(0, lastBracket + 1);
    cleaned = cleaned.replace(/\r?\n|\r/g, " ").replace(/\s+/g, "");
  }  
  return cleaned;
}

/**
 * Validar estructura y balance del asiento
 */
function validateEntries(entries: JournalEntryRaw[]): void {
  if (entries.length) throw new Error("No se generaron asientos contables");
  if (entries.length > 10) {
    throw new Error(`Demasiados asientos: ${entries.length}. Máximo esperado: 10`);
  }
  const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01)
    throw new Error(
      `Asiento desbalanceado: Débito ${totalDebit}, Crédito ${totalCredit}`
    );
}

/* -------------------------------------------------------------------------- */
/* 🧩 PROCESADORES                                                            */
/* -------------------------------------------------------------------------- */

// 1️⃣ Texto plano completo (OCR)
async function processFullText(
  fullText: string,
  userRUC: string,
  today: string,
  issuerRUC?: string,
  supplier_name?: string
): Promise<JournalEntryRaw[]> {
  console.log("📄 Procesando texto completo OCR...");

  const userPrompt = `
RUC de la empresa contable: ${userRUC}
Fecha actual: ${today}
RUC del proveedor: ${issuerRUC || "Desconocido"}
Nombre del proveedor: ${supplier_name || "Desconocido"}

Texto completo de la factura:
${fullText}

Devuelve el asiento contable balanceado como JSON.
`.trim();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 2000,
    messages: [
      { role: "system", content: ACCOUNTING_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = response.choices?.[0]?.message?.content ?? "";
  console.log("GPT-4O output (primeros 500 chars):", raw.slice(0, 500));

  if (!raw.trim()) {
    console.warn("⚠️ GPT no devolvió contenido. Se usará fallback local.");
    return [];
  }

  const cleaned = cleanJSONResponse(raw);
  console.log("🧹 JSON limpio (primeros 300 chars):", cleaned.slice(0, 300));

 try {
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed) || parsed.length === 0) {
      console.warn("⚠️ GPT devolvió JSON vacío o inválido. Se usará fallback local.");
      return [];
    }
  
  validateEntries(parsed);
  return parsed;
} catch (error: any) {
    console.error("❌ Error parseando JSON:", error.message);
    console.error("📄 Contenido:", cleaned.slice(0, 1000));
    return [];
  }
}

// 2️⃣ PDF completo (modo alterno)
async function processFullPDF(
  pdfBase64: string,
  userRUC: string,
  today: string
): Promise<JournalEntryRaw[]> {
  console.log("📄 Procesando PDF completo con GPT-4-Vision...");
  const userPrompt = `
RUC de la empresa: ${userRUC}
Fecha actual: ${today}

Analiza esta factura ecuatoriana y genera el asiento contable balanceado.
Responde SOLO con el JSON array.
`.trim();

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 2000,
    messages: [
      { role: "system", content: ACCOUNTING_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          {
            type: "image_url",
            image_url: {
              url: `data:application/pdf;base64,${pdfBase64}`,
              detail: "high",
            },
          },
        ],
      },
    ],
  });

  const raw = response.choices?.[0]?.message?.content ?? "";
  const cleaned = cleanJSONResponse(raw);
  const parsed = JSON.parse(cleaned);
  validateEntries(parsed);
  return parsed;
}

// 3️⃣ Bloques de texto visual (Layout)
async function processTextBlocks(
  blocks: any[],
  userRUC: string,
  today: string
): Promise<JournalEntryRaw[]> {
  console.log("📋 Procesando bloques de texto visual...");
  const relevantBlocks = blocks.filter((b) =>
    /ruc|factura|autorizaci[oó]n|subtotal|iva|total|proveedor|cliente|forma de pago|efectivo|transferencia|valor total/i.test(
      b.text?.toLowerCase() ?? ""
    )
  );
  console.log(`🔹 Bloques relevantes: ${relevantBlocks.length} de ${blocks.length}`);

  const visualText = relevantBlocks.map((b) => b.text).join("\n");
  const userPrompt = `
RUC de la empresa: ${userRUC}
Fecha actual: ${today}

Texto extraído de la factura:
${visualText}

Genera el asiento contable balanceado en formato JSON.
`.trim();

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 2000,
    messages: [
      { role: "system", content: ACCOUNTING_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = response.choices?.[0]?.message?.content ?? "";
  const cleaned = cleanJSONResponse(raw);
  const parsed = JSON.parse(cleaned);
  validateEntries(parsed);
  return parsed;
}

/**
 * Handler principal
 */
const handler: Handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  const start = Date.now();

  try {
    const { fullText, userRUC, entityType, issuerRUC, supplier_name, blocks, pdfBase64 } =
      JSON.parse(event.body || "{}");

    if (!userRUC || typeof userRUC !== "string") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "userRUC es requerido" }),
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    let entries: JournalEntryRaw[] = [];

    // ✅ Nuevo modo fullText (prioritario)
    if (fullText && typeof fullText === "string" && fullText.trim().length > 100) {
      entries = await processFullText(fullText, userRUC, today, issuerRUC, supplier_name);
    }
    if (!entries || entries.length === 0) {
      console.warn("⚙️ Usando fallback contable local (sin IA).");
      entries = [
        {
          date: today,
          account_code: "5099901",
          account_name: "OTROS GASTOS (NIVEL 5)",
          description: "Compra local – Fallback",
          debit: 100.0,
          credit: null,
          type: "expense",
        },
        {
          date: today,
          account_code: "1010501",
          account_name: "CRÉDITO TRIBUTARIO IVA",
          description: "IVA 15%",
          debit: 15.0,
          credit: null,
          type: "expense",
        },
        {
          date: today,
          account_code: "201030102",
          account_name: "PROVEEDORES",
          description: "Factura local – Fallback",
          debit: null,
          credit: 115.0,
          type: "expense",
        },
      ];
    }
    // 🧩 Modo alterno: PDF (por si se envía)
    else if (pdfBase64) {
      entries = await processFullPDF(pdfBase64, userRUC, today);
    }
    // 🧩 Modo alterno: bloques visuales (solo si existe)
    else if (Array.isArray(blocks) && blocks.length > 0) {
      entries = await processTextBlocks(blocks, userRUC, today);
    }
    // ❌ Si nada válido fue enviado
    else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Se requiere 'fullText', 'blocks' o 'pdfBase64'" }),
      };
    }

    const duration = Date.now() - start;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        entries,
        metadata: {
          processedAt: new Date().toISOString(),
          durationMs: duration,
          entriesCount: entries.length,
        },
      }),
    };
  } catch (error: any) {
    console.error("❌ Error en extract-invoice:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

export { handler };