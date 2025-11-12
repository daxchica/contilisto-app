// src/ai/extractInvoiceDataWithLayoutAI.ts
import type { JournalEntry } from "../types/JournalEntry";
import type { TextBlock } from "../types/TextBlock";

/**
 * Llama al backend /netlify/functions/extract-invoice-layout
 * para procesar bloques OCR visuales con OpenAI de forma segura.
 */
export async function extractInvoiceDataWithLayoutAI(
  blocks: TextBlock[],
  userRUC: string
): Promise<JournalEntry[]> {
  if (!blocks || blocks.length === 0) {
    console.warn("⚠️ extractInvoiceDataWithLayoutAI recibió 0 bloques.");
    return [];
  }

  try {
    const response = await fetch("/.netlify/functions/extract-invoice-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks, userRUC }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Error extract-invoice-layout:", text);
      throw new Error(`extract-invoice-layout returned ${response.status}`);
    }

    const parsed = await response.json();
    if (!Array.isArray(parsed)) {
      console.warn("⚠️ La respuesta del servidor no es un array:", parsed);
      return [];
    }

    console.log(`✅ extractInvoiceDataWithLayoutAI: ${parsed.length} asientos recibidos`);
    return parsed as JournalEntry[];
  } catch (err) {
    console.error("❌ Error calling extract-invoice-layout:", err);
    return [];
  }
}