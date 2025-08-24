import { JournalEntry } from "../types/JournalEntry";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

/* const SYSTEM_PROMPT = `
Eres un contador experto en normativas ecuatorianas. Tu tarea es analizar el texto plano de una factura obtenido por OCR. 

⚠️ El OCR presenta los valores en una línea corrida, colocando los **valores a la izquierda** de su etiqueta correspondiente. Debes interpretar estos valores en orden inverso al listado de conceptos.

📌 Conceptos clave a identificar (en orden inverso):
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

Ejemplo OCR:
71.37 SUBTOTAL 12% 0.00 SUBTOTAL 0% 0.00 SUBTOTAL NO OBJETO DE IVA
→ Interpretación:
- SUBTOTAL 12% = 71.37
- SUBTOTAL 0% = 0.00
- SUBTOTAL NO OBJETO DE IVA = 0.00

📌 Reglas de interpretación:
1. Si el RUC del emisor = RUC de la entidad activa en el EntitiesDashboard → es una **VENTA** ("income").
2. Si el RUC del emisor ≠ RUC de la entidad activa en el EntitiesDashboard → es una **COMPRA** ("expense").
3. Si SUBTOTAL 12% = 0 o no existe → usa SUBTOTAL 0% como base imponible.

📌 Estructura de salida esperada (JSON puro, sin texto adicional):
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

👉 EN COMPRAS (expense):
- SUBTOTAL SIN IMPUESTOS → debit "60601", "Compras locales"
- ICE → debit "53901", "Otros tributos"
- IVA 12% → debit "1010501", "CREDITO TRIBUTARIO A FAVOR DE LA EMPRESA (IVA)"  ⚠️ ACTIVO, siempre va en el DEBE
- VALOR TOTAL → credit "21101", "Cuentas por pagar comerciales locales"

👉 EN VENTAS (income):
- SUBTOTAL 12% o SUBTOTAL 0% → credit "70101", "Ventas locales"
- IVA 12% → credit "24302", "IVA débito tributario"
- VALOR TOTAL → debit "1020901", "CUENTAS Y DOCUMENTOS A COBRAR A CLIENTES"

🧾 Siempre incluye el asiento del IVA aunque sea 0.00.

Devuelve únicamente el arreglo JSON de asientos contables, sin explicaciones, sin comentarios y sin etiquetas Markdown.
`;
*/

export const SYSTEM_PROMPT = `
Eres un contador experto en normativa ecuatoriana. Recibirás TEXTO OCR de una factura (línea corrida). 
El OCR pone los VALORES numéricos a la IZQUIERDA de su etiqueta. Debes leer el cuadro-resumen de DERECHA a IZQUIERDA a partir de estas claves:

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

Ejemplo OCR: 
"71.37 SUBTOTAL 12% 0.00 SUBTOTAL 0% ..."
Interpreta:
SUBTOTAL 12% = 71.37 ; SUBTOTAL 0% = 0.00

REGLAS DE TIPO (muy importante):
- Si RUC_EMISOR == RUC_ENTIDAD_ACTIVA → "income" (VENTA).
- Si RUC_EMISOR != RUC_ENTIDAD_ACTIVA → "expense" (COMPRA).

EXTRACCIÓN:
- Obtén: SUBTOTAL 12%, SUBTOTAL 0%, ICE, IVA 12%, VALOR TOTAL. Si SUBTOTAL 12% es 0 o no aparece, usa SUBTOTAL 0% como base.
- Extrae "invoice_number" con el patrón ###-###-######### si existe.
- No generes valores negativos. Usa 2 decimales. Si una partida no aplica, su importe es 0.00 pero IGUAL incluye el asiento de IVA.

SALIDA: Devuelve SOLO un arreglo JSON de asientos (sin texto adicional), con objetos:
{
  "date": "YYYY-MM-DD",
  "description": "Descripción contable",
  "account_code": "PUC",
  "account_name": "Nombre cuenta",
  "debit": number,
  "credit": number,
  "type": "income" | "expense",
  "invoice_number": "###-###-#########"
}

POLÍTICA DE CUENTAS:

COMPRAS ("expense"):
- Base imponible de compras (SUBTOTAL 12% o 0% según corresponda) → DEBIT "60601", "Compras locales".
- ICE → DEBIT "53901", "Otros tributos".
- IVA 12% → DEBIT "1010501", "CREDITO TRIBUTARIO A FAVOR DE LA EMPRESA (IVA)".  // Tratamiento como ACTIVO (IVA crédito).
- VALOR TOTAL → CREDIT "21101", "Cuentas por pagar comerciales locales".

VENTAS ("income"):
- Base imponible de ventas (SUBTOTAL 12% o, si 12%==0, SUBTOTAL 0%) → CREDIT "70101", "Ventas locales".
- IVA 12% → CREDIT "24302", "IVA débito tributario".
- VALOR TOTAL → DEBIT "1020901", "CUENTAS Y DOCUMENTOS A COBRAR A CLIENTES".

NOTAS:
- Siempre incluye la partida de IVA aunque sea 0.00.
- La suma del DEBE debe igualar la suma del HABER por factura.
- "description" puede ser el nombre de la cuenta.
- Cuando falten datos, prioriza consistencia (no inventes códigos ni nombres diferentes a los indicados).

Devuelve únicamente el arreglo JSON de asientos.
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