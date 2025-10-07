// src/services/extractInvoiceDataWithAI.ts

import { v4 as uuidv4 } from "uuid";
import type { JournalEntry } from "../types/JournalEntry";
import { normalizeEntry, canonicalPair } from "../utils/accountPUCMap";

export async function extractInvoiceDataWithAI(
  fullText: string,
  entityRUC: string
): Promise<JournalEntry[]> {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const response = await fetch("/api/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullText, entityRUC }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const parsed = await response.json();
    if (!Array.isArray(parsed)) return [];

    const raw = parsed
      .map((r) => coerceOne(r, "expense", today, entityRUC))
      .filter((e): e is JournalEntry => e !== null);

    return raw.map((e) => ({
      ...normalizeEntry(e),
      id: uuidv4(),
    }));
  } catch (err) {
    console.error("❌ Error calling extractinvoice:", err);
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
  fallbackDate: string,
  entityRUC: string
): JournalEntry | null {
  const debit = toNum(r?.debit);
  const credit = toNum(r?.credit);
  if (!debit && !credit) return null;

  const description = String(r?.description ?? "").slice(0, 300);

  const rawCode = String(r?.account_code ?? "");
  const rawName = String(r?.account_name ?? "");
  const pair = canonicalPair({ code: rawCode, name: rawName });

  const date = typeof r?.date === "string" ? r.date.slice(0, 10) : fallbackDate;

  const tipoDetectado: "expense" | "income" =
    r?.type === "expense" || r?.type === "income"
      ? r.type
      : r?.issuerRUC && r?.issuerRUC !== entityRUC
      ? "expense"
      : "income";

  const je: JournalEntry = {
    date,
    description,
    account_code: pair.code || "",
    account_name: pair.name || "",
    debit: debit && !credit ? debit : debit && credit && debit >= credit ? debit : undefined,
    credit: credit && !debit ? credit : debit && credit && credit > debit ? credit : undefined,
    type: tipoDetectado,
    invoice_number: r?.invoice_number ? String(r.invoice_number) : "",
    source: "ai",
  };

  return je;
}