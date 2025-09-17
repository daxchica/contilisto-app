// netlify/functions/extractInvoice.ts

import { Handler } from '@netlify/functions';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
Eres un experto contable ecuatoriano con dominio del Plan Único de Cuentas (PUC). Tu tarea es analizar el contenido de una factura en texto plano y devolver las partidas contables estructuradas según el PUC.

Genera un arreglo de objetos JSON, donde cada objeto representa un asiento contable con los siguientes campos obligatorios:

- date: fecha del asiento (usa la fecha de hoy en formato YYYY-MM-DD)
- description: descripción del concepto contable
- account_code: código exacto del PUC según el tipo de gasto
- account_name: nombre de la cuenta según el PUC
- debit: monto a debitar (usa \`debit\` solo si aplica)
- credit: monto a acreditar (usa \`credit\` solo si aplica)
- type: "expense" si es factura de compra, "income" si es factura de venta
- invoice_number: número de factura en formato ###-###-#########

Usa estas cuentas contables cuando correspondan:

🔹 Gastos:
- Subtotal o valor neto de compra:  
  - account_code: "60601", account_name: "Compras locales"
- Impuesto ICE:  
  - account_code: "53901", account_name: "Otros tributos"
- IVA crédito tributario:  
  - account_code: "24301", account_name: "IVA crédito tributario"
- Total por pagar:  
  - account_code: "21101", account_name: "Cuentas por pagar comerciales locales"

🔹 Ventas (para ingresos):
- Subtotal o ingreso neto:  
  - account_code: "70101", account_name: "Ventas locales"
- IVA por pagar:  
  - account_code: "24302", account_name: "IVA débito tributario"
- Total recibido:  
  - account_code: "11101", account_name: "Caja"

Devuelve únicamente el JSON sin explicación ni texto adicional. No uses formato Markdown (no pongas "\`\`\`json").
`;

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  try {
    const { fullText, entityRUC } = JSON.parse(event.body || '{}');

    if (!fullText || !entityRUC) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing fullText or entityRUC in request body' }),
      };
    }

    const today = new Date().toISOString().split('T')[0];

    const userPrompt = `
RUC de la empresa del usuario: ${entityRUC}
Texto extraído de la factura por OCR:
"""${fullText}"""
Fecha actual: ${today}
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT.trim() },
        { role: 'user', content: userPrompt.trim() },
      ],
    });

    const raw = response.choices?.[0]?.message?.content ?? '';

    const cleaned = raw
      .replace(/^```json/, '')
      .replace(/^```/, '')
      .replace(/```$/, '')
      .trim();

    let parsed: any;

    try {
      parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error('Expected JSON array');
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError, '\nRaw response:\n', raw);
      return {
        statusCode: 422,
        body: JSON.stringify({
          error: 'OpenAI response could not be parsed as valid JSON array',
          raw,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(parsed),
    };
  } catch (error: any) {
    console.error('❌ Internal Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        stack: error.stack,
      }),
    };
  }
};

export { handler };