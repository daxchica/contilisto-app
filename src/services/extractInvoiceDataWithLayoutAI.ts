// src/ai/extractInvoiceDataWithLayoutAI.ts

import type { JournalEntry } from "../types/JournalEntry";
import type { TextBlock } from "../types/TextBlock";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

function buildPrompt(textBlocks: TextBlock[], userRUC: string): string {
  const visualData = textBlocks.map(b => {
    const { text, x, y, width, height, page } = b;
    return `[Page ${page}] (${x},${y},${width},${height}) → ${text}`;
  }).join("\n");

  return `
Eres un experto contador en Ecuador. Tienes acceso a un escaneo visual de una factura en forma de bloques de texto posicionados.

Extrae los valores contables para registrar la factura en asientos contables. Aplica el PUC ecuatoriano y considera lo siguiente:

- El RUC de la entidad contable es: ${userRUC}
- Determina si es una factura de ingreso o de gasto.
- Si hay valores como ICE, IVA, SUBTOTAL o TOTAL, usa el desglose contable adecuado.
- Utiliza nombres claros y códigos contables estimados como "5XXXX - Compras", "2XXXX - IVA por pagar", etc.

Bloques visuales:
${visualData}

Devuelve un array JSON de objetos tipo JournalEntry con los campos: date, account_code, account_name, description, debit, credit, type ("income" o "expense"), invoice_number (si existe).
`.trim();
}

export async function extractInvoiceDataWithLayoutAI(
  blocks: TextBlock[],
  userRUC: string
): Promise<JournalEntry[]> {
  const apiKey = process.env.OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not found");

  const prompt = buildPrompt(blocks, userRUC);

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Eres un contador experto en Ecuador." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("OpenAI API Error:", error);
    throw new Error("Failed to extract invoice data with layout AI");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error("Expected array of JournalEntry");
    return parsed as JournalEntry[];
  } catch (err) {
    console.error("JSON parse error:", err);
    throw new Error("Invalid response format from OpenAI");
  }
}