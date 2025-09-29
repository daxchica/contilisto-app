// src/services/extractInvoiceFromAPI.ts

import type { JournalEntry } from "../types/JournalEntry";
import { normalizeEntry, canonicalPair } from "../utils/accountPUCMap";

/**
 * Extrae los asientos contables desde el endpoint OCR clásico (/api/extract-invoice)
 * usando texto plano y lógica AI basada en prompt.
 */
export async function extractInvoiceFromAPI(fullText: string, entityRUC: string): Promise<JournalEntry[]> {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const response = await fetch("/api/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullText, userRUC: entityRUC }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    
    const parsed = await response.json();
    if (!Array.isArray(parsed)) return [];

    const rawEntries = parsed
      .map((raw) => coerceOne(raw, "expense", today, entityRUC))
      .filter((e): e is JournalEntry => e !== null); // 👈 Tipado fuerte

    return rawEntries.map(normalizeEntry);
  } catch (err) {
    console.error("❌ Error calling extract-invoice:", err);
    return [];
  }
}

/**
 * Convierte un valor a número decimal redondeado a 2 decimales si es válido y mayor a 0.
 */
function toNum(x: any): number | undefined {
  const n = typeof x === "string" ? parseFloat(x) : x;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}

/**
 * Transforma un objeto plano recibido desde el backend en un JournalEntry bien tipado.
 */
function coerceOne(
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

  // Detectar tipo de asiento: si el emisor es distinto al RUC de la entidad => compra (expense)
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
    source: "ai",
  };
}