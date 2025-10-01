import { Handler, HandlerCallback, HandlerContext, HandlerEvent } from '@netlify/functions';
import { OpenAI } from 'openai';

if (!process.env.OPENAI_API_KEY) {
  console.error('Falta OPENAI_API_KEY en variables de entorno');
  throw new Error("Missing OpenAI API Key");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // 🔒 Solo en el backend
});

const SYSTEM_PROMPT = `
Eres un contador ecuatoriano experto en análisis de facturas electrónicas escaneadas por OCR. 
Tu tarea es generar los asientos contables correctamente utilizando el Plan Único de Cuentas (PUC) del Ecuador.

🧠 INSTRUCCIONES CLAVE:

1. Analiza el cuadro resumen de la factura. Si contiene líneas como:

- "SUBTOTAL 12%", "SUBTOTAL 15%" → base gravada
- "SUBTOTAL 0%" → base no gravada
- "IVA 12%", "IVA 15%" → impuesto
- "VALOR TOTAL" → valor total facturado

2. Si existe un "SUBTOTAL 12%" o "SUBTOTAL 15%", regístralo con cuenta de compras locales.
3. Si existe un "SUBTOTAL 0%", regístralo como gasto no gravado (también en compras locales).
4. Si hay "IVA", regístralo con cuenta de IVA crédito tributario.
5. El total debe acreditarse a proveedores.

📘 CUENTAS CONTABLES A UTILIZAR:

🔹 Compras:
- Base imponible (12% o 15%) → "60601", "Compras locales"
- Base no gravada (0%)       → "60601", "Compras locales"
- IVA crédito tributario     → "24301", "IVA crédito tributario"
- ICE (si aplica)            → "53901", "Otros Tributos"
- Total a pagar              → "21101", "Cuentas por pagar comerciales locales"

🔹 Ventas:
- Subtotal ingreso neto      → "70101", "Ventas locales"
- IVA débito tributario      → "24302", "IVA débito tributario"
- Total recibido (efectivo)  → "11101", "Caja"

🎯 OBJETIVO:
- El asiento debe estar cuadrado (total débitos = total créditos).
- Usa máximo 4 líneas.
- Incluye: date, description, account_code, account_name, debit, credit, type, invoice_number
- Devuelve SOLO el arreglo JSON (sin explicación, sin encabezados, sin código markdown).
- Muestra valores con máximo 2 decimales, como números (no strings).
`;

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { fullText, entityRUC, userRUC } = JSON.parse(event.body || '{}');

    const ruc = entityRUC?.trim() || userRUC?.trim();

    if (!fullText?.trim() || !ruc) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing fullText or entityRUC in request body' }),
      };
    }

    console.log('📥 fullText:', fullText.slice(0, 150));
    console.log('🏢 entityRUC:', entityRUC);

    const today = new Date().toISOString().split('T')[0];

    const userPrompt = `
RUC de la empresa del usuario: ${ruc}
Texto extraído de la factura por OCR:
"""${fullText}"""
Fecha actual: ${today}
`.trim();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT.trim() },
        { role: 'user', content: userPrompt.trim() },
      ],
    });

    const raw = response.choices?.[0]?.message?.content ?? '';
    console.log('🧾 Raw GPT:', raw.slice(0, 500));

    const cleaned = raw
      .replace(/```json[\s\S]*?```/gi, (match) => match.replace(/```json|```/gi, "").trim())
      .replace(/^```|```$/g, '')
      .trim();

    let parsed: any;

    try {
      parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error('Expected JSON array');
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError, 'Texto OCR:', fullText, '\nRaw response:\n', raw);
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