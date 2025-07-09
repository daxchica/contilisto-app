import { JournalEntry } from "../utils/accountMapper";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
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

Ejemplo de salida:

[
  {
    "date": "2025-06-28",
    "description": "Compra de suministros",
    "account_code": "60601",
    "account_name": "Compras locales",
    "debit": 100.00,
    "type": "expense",
    "invoice_number": "001-001-000123456"
  },
  {
    "date": "2025-06-28",
    "description": "IVA crédito",
    "account_code": "24301",
    "account_name": "IVA crédito tributario",
    "debit": 12.00,
    "type": "expense",
    "invoice_number": "001-001-000123456"
  },
  {
    "date": "2025-06-28",
    "description": "Total por pagar al proveedor",
    "account_code": "21101",
    "account_name": "Cuentas por pagar comerciales locales",
    "credit": 112.00,
    "type": "expense",
    "invoice_number": "001-001-000123456"
  }
]
`;

export async function extractInvoiceDataWithAI_gpt4(fullText: string, userRUC: string): Promise<JournalEntry[]> {
  const today = new Date().toISOString().split("T")[0];

  const userPrompt = `
RUC de la empresa del usuario: ${userRUC}
Texto extraído de la factura por OCR:
"""${fullText}"""
Fecha actual: ${today}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT.trim() },
        { role: "user", content: userPrompt.trim() }
      ],
    });

    const raw = response.choices[0].message.content ?? "";

    const cleaned = raw
      .replace(/^```json/, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      console.warn("⚠️ GPT-4 returned non-array data:", parsed);
      return [];
    }

    const validEntries: JournalEntry[] = parsed.filter((entry: any) =>
      entry?.account_code && (entry?.debit || entry?.credit)
    );
    return validEntries;

  } catch (err) {
    console.error("❌ GPT-4 fallback failed:", err);
    return [];
  }
}