// src/services/extractInvoiceFromLayoutAPI.ts

import type { JournalEntry } from "../types/JournalEntry";
import type { TextBlock } from "../types/TextBlock";
import { normalizeEntry, canonicalPair } from "../utils/accountPUCMap";

/**
 * Filtra solo los bloques relevantes visualmente para minimizar tokens
 */
function filterRelevantBlocks(blocks: TextBlock[]): TextBlock[] {
  return blocks.filter((b) =>
    /ruc|factura|autorizaci[oó]n|subtotal|iva|total|proveedor|cliente|forma de pago|efectivo|transferencia|valor total/i.test(
      b.text.toLowerCase()
    )
  );
}

/**
 * Llama al endpoint de Netlify Function para procesar facturas usando LayoutAI.
 */
export async function extractInvoiceFromLayoutAPI(
  blocks: TextBlock[],
  entityRUC: string
): Promise<JournalEntry[]> {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const filtered = filterRelevantBlocks(blocks);

    const response = await fetch("/api/extract-invoice-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks, userRUC: entityRUC }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const parsed = await response.json();
    console.log("Respuesta LayoutAI:", parsed);

    if (!Array.isArray(parsed)) return [];

    const rawEntries = parsed
      .map((r) => coerceLayoutEntry(r, "expense", today, entityRUC))
      .filter((e): e is JournalEntry => e !== null);

    return rawEntries.map(normalizeEntry);
  } catch (err) {
    console.error("❌ Error calling extract-invoice-layout:", err);
    return [];
  }
}

/**
 * Convierte un valor genérico en número decimal con dos decimales si es válido.
 */
function toNum(x: any): number | undefined {
  const n = typeof x === "string" ? parseFloat(x) : x;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}

/**
 * Transforma una respuesta bruta de la API visual en un JournalEntry tipado.
 */
function coerceLayoutEntry(
  r: any,
  fallbackType: "expense" | "income",
  fallbackDate: string,
  entityRUC: string
): JournalEntry | null {
  const debit = toNum(r?.debit);
  const credit = toNum(r?.credit);
  if (!debit && !credit) return null;

  const description = String(r?.description ?? "").slice(0, 300);
  const rawCode = String(r?.account_code ?? "");
  const rawName = String(r?.account_name ?? "");
  const date = typeof r?.date === "string" ? r.date.slice(0, 10) : fallbackDate;
  const pair = canonicalPair({ code: rawCode, name: rawName });

  const tipoDetectado: "expense" | "income" =
    r?.type === "expense" || r?.type === "income"
      ? r.type
      : r?.issuerRUC && r?.issuerRUC !== entityRUC
      ? "expense"
      : "income";

  return {
    date,
    description,
    account_code: (pair as any).code || "",
    account_name: (pair as any).name || "",
    debit: debit && !credit ? debit : debit && credit && debit >= credit ? debit : undefined,
    credit: credit && !debit ? credit : debit && credit && credit > debit ? credit : undefined,
    type: tipoDetectado,
    invoice_number: r?.invoice_number ? String(r.invoice_number) : "",
    source: "ai-layout",
  };
}