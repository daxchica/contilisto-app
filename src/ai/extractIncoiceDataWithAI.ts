// ✅ Mejorada para arquitectura con Netlify (sin exponer API key en frontend)
// Archivo destino: src/services/extractInvoiceFromAPI.ts

import type { JournalEntry } from "../types/JournalEntry";
import { normalizeEntry, canonicalPair } from "../utils/accountPUCMap";

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

    const entries: JournalEntry[] = parsed
      .map((r) => coerceOne(r, "expense", today))
      .filter(Boolean) as JournalEntry[];

    return entries.map((e) => normalizeEntry(e));
  } catch (err) {
    console.error("❌ Error calling extract-invoice:", err);
    return [];
  }
}

function toNum(x: any): number | undefined {
  const n = typeof x === "string" ? parseFloat(x) : x;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}

function coerceOne(
  r: any,
  fallbackType: "expense" | "income",
  fallbackDate: string
): JournalEntry | null {
  const debit = toNum(r?.debit);
  const credit = toNum(r?.credit);
  if (!debit && !credit) return null;

  const description = String(r?.description ?? "").slice(0, 300);
  const pair = canonicalPair({
    code: String(r?.account_code ?? ""),
    name: String(r?.account_name ?? ""),
  });

  const type: "expense" | "income" =
    r?.type === "expense" || r?.type === "income" ? r.type : fallbackType;

  const date = r?.date && typeof r.date === "string" ? r.date.slice(0, 10) : fallbackDate;

  const je: JournalEntry = {
    date,
    description,
    account_code: (pair as any).code || "",
    account_name: (pair as any).name || "",
    debit: debit && !credit ? debit : debit && credit && debit >= credit ? debit : undefined,
    credit: credit && !debit ? credit : debit && credit && credit > debit ? credit : undefined,
    type,
    invoice_number: r?.invoice_number ? String(r.invoice_number) : "",
    source: "ai",
  };
  return je;
}