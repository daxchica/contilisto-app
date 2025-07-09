import { JournalEntry } from "../utils/accountMapper";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const SYSTEM_PROMPT = `
Eres un contador experto en normativas ecuatorianas y debes analizar el texto plano generado por un sistema OCR de una factura. Este OCR extrae los valores y conceptos **en una línea corrida**, colocando los **valores numéricos a la izquierda** de su etiqueta correspondiente.

📌 Tu tarea es interpretar correctamente el cuadro resumen de la factura, ubicando los valores **de derecha a izquierda**, partiendo de los textos clave como:

- SUBTOTAL 12%
- SUBTOTAL 0%
- SUBTOTAL NO OBJETO DE IVA
- SUBTOTAL EXENTO DE IVA
- SUBTOTAL SIN IMPUESTOS
- TOTAL DESCUENTO
- ICE
- IVA 12%
- TOTAL DEVOLUCION IVA
- IRBPNR
- PROPINA
- VALOR TOTAL

🔍 Cuando encuentres la frase **"SUBTOTAL 12%"** o **"SUBTOTAL 0%"**, **los valores están hacia la izquierda**, en orden inverso al listado anterior. Por ejemplo:

📄 Ejemplo OCR:
71.37 SUBTOTAL 12% 0.00 SUBTOTAL 0% 0.00 SUBTOTAL NO OBJETO DE IVA ...

🔄 Interpreta como:
- SUBTOTAL 12% = 71.37
- SUBTOTAL 0% = 0.00
- SUBTOTAL NO OBJETO DE IVA = 0.00

⚠️ Si el valor de **SUBTOTAL 12%** es 0.00 o no está presente, debes usar **SUBTOTAL 0%** como base imponible de ventas.

📌 Reglas para determinar el tipo:
- Si el RUC del emisor es igual al del usuario: es una **venta** ("income").
- Si el RUC es diferente o no se encuentra: es una **compra** ("expense").

📌 Estructura contable esperada (en JSON):
{
  date: "YYYY-MM-DD",
  description: "Descripción contable",
  account_code: "PUC",
  account_name: "Nombre cuenta",
  debit: 0.00,
  credit: 0.00,
  type: "income" | "expense",
  invoice_number: "###-###-#########"
}

🎯 Reglas contables:

👉 En COMPRAS (expense):
- SUBTOTAL SIN IMPUESTOS → debit "60601", "Compras locales"
- ICE → debit "53901", "Otros tributos"
- IVA 12% → debit "24301", "IVA crédito tributario"
- VALOR TOTAL → credit "21101", "Cuentas por pagar comerciales locales"

👉 En VENTAS (income):
- SUBTOTAL 12% o SUBTOTAL 0% → credit "70101", "Ventas locales"
- IVA 12% → credit "24302", "IVA débito tributario"
- VALOR TOTAL → debit "11101", "Caja"

🧾 Siempre incluye el asiento del IVA aunque sea 0.00.

Devuelve sólo el arreglo JSON, sin explicaciones, sin comentarios, sin etiquetas Markdown.
`;

export async function extractInvoiceDataWithAI_gpt4o(fullText: string, userRUC: string): Promise<JournalEntry[]> {
  const today = new Date().toISOString().split("T")[0];

  const userPrompt = `
RUC of the user's company: ${userRUC}
OCR Extracted Invoice Text:
"""${fullText}"""
Today's date: ${today}
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT.trim() },
        { role: "user", content: userPrompt.trim() }
      ],
    });

    const raw = response.choices[0].message.content ?? "";

    const cleaned = raw
      .replace(/^```json/g, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    const validEntries: JournalEntry[] = parsed.filter((entry: any) =>
      entry?.account_code && (entry?.debit !== undefined || entry?.credit !== undefined)
    );
    return validEntries;

  } catch (err) {
    console.error("❌ GPT-4o extraction failed:", err);
    return [];
  }
}