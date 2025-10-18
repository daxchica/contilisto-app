// ../netlify/functions/extract-invoice.ts

import { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { OpenAI } from 'openai';
import { ACCOUNTING_PROMPT } from "../prompts/accountingPoliciesPrompt";

/* =======================================================
   🔐 1. Validación de clave API
======================================================= */
if (!process.env.OPENAI_API_KEY) {
  console.error('Falta OPENAI_API_KEY en variables de entorno');
  throw new Error("Missing OpenAI API Key");
}

console.log("Clave OpenAI cargada:", process.env.OPENAI_API_KEY?.slice(0, 6), "******");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // 🔒 Solo en el backend
});

/* =======================================================
   🧠 2. Función principal
======================================================= */
export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  console.log("Nueva solicitud a /api/extract-invoice recibida");
  try {
    if (event.httpMethod !== 'POST') {
      console.warn("Metodo HTTP no permitido:", event.httpMethod);
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' }),
      };
    }

  
    /* ---------------------- Parseo de cuerpo ---------------------- */
    const body = JSON.parse(event.body || '{}');
    console.log("Body recibido:", body);
  
    const fullText = typeof body.fullText === "string" ? body.fullText.trim() : '';
    const entityRUC = typeof body.entityRUC === "string" ? body.entityRUC.trim() : '';
    const userRUC = typeof body.userRUC === "string" ? body.userRUC.trim() : '';
    const entityType = typeof body.entityType === "string" ? body.entityType.trim().toLowerCase() : "servicios";
    const entityKind = (entityType || 'servicios').trim().toLowerCase();
    
    const ruc = (entityRUC || userRUC || '').trim();

    /* ---------------------- Validaciones iniciales ---------------------- */
    if (!fullText?.trim() || !ruc) {
      console.error("Faltan campos obligatorios:", {
        fullTextOK: !!fullText?.trim(),
        rucOK: !!ruc,
        fullTextLength: fullText?.length,
        fullTextPreview: fullText?.slice(0, 100),
        entityRUC,
        userRUC,
        entityType,
      });

      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing fullText or entityRUC in request body' 
        }),
      };
    }

    /* ---------------------- Logs de información ---------------------- */
    console.log("✅ Recibido extract-invoice request");
    console.log("🏢 Tipo de empresa:", entityType);
    console.log("🆔 RUC:", ruc);
    console.log("🧾 Texto OCR (inicio):", fullText.slice(0, 200));

    const today = new Date().toISOString().split('T')[0];

    const systemPrompt = ACCOUNTING_PROMPT.replace('{{entityType}}', entityKind);
    const userPrompt = `
RUC de la empresa del usuario: ${ruc}
Texto extraído de la factura por OCR:
"""${fullText}"""
Fecha actual: ${today}
`.trim();

    /* ---------------------- Llamada a OpenAI ---------------------- */
    console.log("📤 Enviando prompt a OpenAI...");
    console.log("🧠 Tipo de modelo: gpt-4o");
    console.log("🧠 Longitud del texto enviado:", fullText.length);
   
    let response;
    try {
      response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    } catch (apiError: any) {
      console.error("Error al llamar a OpenAI:", {
        message: apiError.message,
        name: apiError.name,
        status: apiError.status,
        details: apiError,
      });
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Error al comunicarse con OpenAI",
          details: apiError.message,
        }),
      };
    }
    
    console.log("OpenAI respondio correctamente");

    /* ---------------------- Procesamiento de respuesta ---------------------- */
    const raw = response.choices?.[0]?.message?.content ?? '';
    if (!raw) {
      console.error("❌ No se recibió contenido de OpenAI.");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'No response content from OpenAI' })
      };
    }
    console.log('🧾 Raw GPT (inicio):', raw.slice(0, 500));

    const cleaned = raw
      .replace(/```json[\s\S]*?```/gi, (match) => match.replace(/```json|```/gi, "").trim())
      .replace(/^```|```$/g, '')
      .trim();

    /* ---------------------- Parseo del JSON ---------------------- */
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

    /* ---------------------- Respuesta final ---------------------- */
    console.log(`Asientos contables generados: ${parsed.length}`);
    console.table(parsed.slice(0, 3)); // muestra los primeros 3 asientos en tabla

    return {
      statusCode: 200,
      body: JSON.stringify(parsed),
    };
  } catch (error: any) {
    /* ---------------------- Catch general ---------------------- */
    console.error('❌ Internal Error:', {
      message: error.message,
      name: error.name,
      fullError: error,
    });

    return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Internal Server Error',
          message: error.message,
      }),
    };
  }
};
