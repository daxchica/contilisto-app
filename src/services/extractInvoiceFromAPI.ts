// src/services/extractInvoiceFromAPI.ts

import type { JournalEntry } from "../types/JournalEntry";
import { normalizeEntry, canonicalPair } from "../utils/accountPUCMap";

/**
 * Extrae los asientos contables desde el endpoint OCR clásico (/api/extractinvoice)
 * usando texto plano y lógica AI basada en prompt.
 */
export async function extractInvoiceFromAPI(
  fullText: string, 
  entityRUC: string
): Promise<JournalEntry[]> {
  const today = new Date().toISOString().slice(0, 10);

  if (!fullText?.trim() || !entityRUC) {
    console.warn("⚠️ extractInvoiceFromAPI recibió valores vacíos:", { fullTextLength: fullText?.length, entityRUC });
    return [];
  }

  try {
    const response = await fetch("/.netlify/functions/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullText, entityRUC}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API error extract-invoice:", response.status, errorText);
      throw new Error(`API returned status ${response.status}`);
    }

    const parsed = await response.json();

    if (!Array.isArray(parsed)) {
      console.error("Respuesta inesperada del backend. Esperado: array de asientos.");
      return [];
    }

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
  const invoice_number = r?.invoice_number ? String(r.invoice_number).trim() : "";

  const pair = canonicalPair({ code: rawCode, name: rawName });

  // Detectar tipo de asiento: si el emisor es distinto al RUC de la entidad => compra (expense)
  const tipoDetectado: "expense" | "income" =
    r?.type === "expense" || r?.type === "income"
      ? r.type
      : r?.issuerRUC && r?.issuerRUC !== entityRUC
      ? "expense"
      : fallbackType;

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