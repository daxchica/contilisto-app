// netlify/functions/extractInvoiceLayout.ts # Netlify Function para extraccion visual (layout)

import { Handler } from '@netlify/functions';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Prompt para GPT-4o
const SYSTEM_PROMPT = `
Eres un contador ecuatoriano experto en análisis de facturas escaneadas.

OBJETIVO: 
Extraer asientos contables validos en formato JSON para el sistema contable Contilisto, utilizando los codigos del Plan Único de Cuentas (PUC) del Ecuador.

🧠 INSTRUCCIONES:
- Analiza los bloques con formato: [Page N] (x,y,width,height) → texto
- Detecta si es compra (expense) o venta (income), comparando el RUC de la empresa con el emisor
- Interpreta correctamente el "cuadro resumen" con subtotales, IVA y TOTAL
- Usa máximo 4 líneas contables cuadradas (suman igual en debito y credito)
- No asumas datos si no estan visibles

Ejemplo de cuentas:
  - Compras locales: 60601
  - IVA crédito tributario: 24301
  - Ventas locales: 70101
  - IVA débito tributario: 24302
  - Cuentas por pagar: 21101
  - Caja o bancos: 11101

🎯 FORMATO DE RESPUESTA (JSON valido, sin explicaciones):
[
  {
    "date": YYYY-MM-DD",
    "account_code": "60601",
    "account_name": "Compras locales",
    "description": "Compra de insumos",
    "debit": 100.0,
    "credit": null,
    "type": "expense"
    "invoice_number": "001-001-000000123"
  },
  ...
]
`.trim();

function filterVisualBlocks(blocks: any[]): any[] {
  return blocks.filter((b) =>
    /ruc|factura|autorizaci[oó]n|subtotal|iva|total|proveedor|cliente|forma de pago|efectivo|transferencia|valor total/i.test(
      b.text?.toLowerCase() ?? ''
    )
  );
}

// 🧱 Construye la cadena visual del layout del PDF
function buildVisualPrompt(blocks: any[]): string {
  return blocks
    .map(
      (b) =>
        `[Page ${b.page}] (${b.x},${b.y},${b.width},${b.height}) → ${b.text}`
    )
    .join("\n");
}

// 🧹 Limpia la respuesta JSON de GPT
function cleanOpenAIResponse(raw: string): string {
  return raw
    .replace(/^```json/, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
}

// Funcion Principal
const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { blocks, userRUC } = JSON.parse(event.body || '{}');

    // Validacion basica
    if (!Array.isArray(blocks) || typeof userRUC != "string") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing blocks or userRUC in request body' }),
      };
    }

    const filteredBlocks = filterVisualBlocks(blocks);
    const today = new Date().toISOString().split('T')[0];

    const userPrompt = `
RUC de la empresa contable: ${userRUC}
Fecha actual: ${today}

Bloques visuales extraídos del PDF:
${buildVisualPrompt(filteredBlocks)}`.trim();

// Llama a GPT-4o
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT.trim() },
        { role: 'user', content: userPrompt.trim() },
      ],
    });

    const raw = response.choices?.[0]?.message?.content ?? '';
    const cleaned = cleanOpenAIResponse(raw);

    let parsed;

    try {
      parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error('Expected JSON array');
    } catch (parseError) {
      console.error('❌ JSON parse error (LayoutAI):', parseError, '\nRAW:\n', raw);
      return {
        statusCode: 422,
        body: JSON.stringify({ 
          error: 'Invalid JSON from OpenAI', 
          raw 
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(parsed),
    };
  } catch (error: any) {
    console.error('❌ Internal Error (LayoutAI):', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
      }),
    };
  }
};

export { handler };