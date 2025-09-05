// src/ai/extractInvoiceDataWithAI.ts
import { OpenAI } from "openai";
import type { JournalEntry } from "../types/JournalEntry";
import { PUCExpense, PUCIncome, resolveByNameOrLabel, makeLookups } from "../shared/puc";

/**
 * Model + client
 */
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

/** Toggle if you want the AI to book ICE as expense lines. */
const INCLUDE_ICE_IN_EXPENSE = true;

/**
 * Extracts entries for any Ecuadorian invoice (gasto/expense OR venta/income).
 * Rule:
 * - If IDENTIFICACION (comprador) == entity RUC => EXPENSE (purchase).
 * - Else => INCOME (sale).
 */
export async function extractInvoiceDataWithAI(
  fullText: string,
  entityRUC: string,
  uiAccounts?: { code: string; name: string }[] // optional: improves name<->code hydration
): Promise<JournalEntry[]> {
  const today = new Date().toISOString().split("T")[0];

  // A small heuristic that often gets it right and helps the model:
  // If the OCR text shows IDENTIFICACION or COMPRADOR near the entity RUC, treat as EXPENSE.
  const probableExpense =
    new RegExp(`(?:(identificaci[oó]n|comprador|cliente)[^\\d]{0,40})${escapeRegExp(entityRUC)}`, "i").test(fullText) ||
    // Many PDFs just repeat the RUC once; if it's present *and* we also see words like "cliente"/"comprador", bias to expense:
    (fullText.includes(entityRUC) && /comprador|cliente|adquirente/i.test(fullText));

  const targetType: "expense" | "income" = probableExpense ? "expense" : "income";

  // Build PUC mapping segment for the system prompt
  const mapBlock = buildPUCBlock(targetType);

  const systemPrompt = `
Eres un asistente contable experto en Ecuador.

Tu tarea es leer una factura escaneada (OCR) y devolver **EXCLUSIVAMENTE** un arreglo JSON de asientos contables (sin Markdown, sin texto extra).
Determina la naturaleza así:
- Si IDENTIFICACION del comprador **coincide** con el RUC de la entidad => tipo "expense".
- En caso contrario => tipo "income".

Usa **estos mapeos PUC** (códigos exactos) para las cuentas y respeta el signo:
${mapBlock}

REGLAS:
- Devuelve un arreglo JSON donde cada objeto contenga: 
  { "date": "YYYY-MM-DD", "description": string, "account_code": string, "account_name": string, "debit": number|null, "credit": number|null, "type": "expense"|"income", "invoice_number": string }
- Usa "date" igual a la fecha de la factura si aparece, si no, usa la fecha de hoy.
- En cada línea, solo uno de {debit, credit} debe tener valor numérico (> 0); el otro debe ser null.
- Redondea a 2 decimales. Asegura que la suma de débitos sea igual a la suma de créditos.
- Si no hay ICE, omite la línea de ICE.
- Evita crear cuentas o códigos nuevos: usa exactamente los códigos/nombres provistos.
- No incluyas ningún texto fuera del JSON.
`.trim();

  const userPrompt = `
RUC de la entidad: ${entityRUC}
Texto OCR de la factura:
"""${fullText}"""
Fecha de hoy (fallback): ${today}

Recuerda aplicar la regla de IDENTIFICACION vs RUC para decidir "expense" o "income".
`.trim();

  const models = ["gpt-4o-mini", "gpt-4o"]; // fast → strong
  let parsed: any = null;

  for (const model of models) {
    try {
      const resp = await openai.chat.completions.create({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const raw = (resp.choices?.[0]?.message?.content || "").trim();
      const cleaned = stripCodeFences(raw);
      parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length) break;
    } catch (err) {
      // Try next model
    }
  }

  if (!Array.isArray(parsed)) {
    // As a safe fallback, return empty.
    return [];
  }

  // Post-process: coerce, normalize, hydrate names/codes to align with your UI dropdowns.
  const entries: JournalEntry[] = coerceEntries(parsed, targetType, today);

  // Final mapping to your UI accounts (to guarantee the Código select matches available options)
  const mapped = mapToUiChart(entries, uiAccounts);

  // Balance check: tiny rounding nudge (≤ 0.01) to last line if needed.
  const balanced = nudgeRounding(mapped);

  return balanced;
}

/* ----------------------- helpers ----------------------- */

function buildPUCBlock(kind: "expense" | "income") {
  const E = PUCExpense;
  const I = PUCIncome;

  if (kind === "expense") {
    const iceLine = INCLUDE_ICE_IN_EXPENSE
      ? `- ICE → Débito "${E.ice.code}" (${E.ice.name})`
      : `- ICE → omitir si no aplica.`;
    return [
      `- Subtotal → Débito "${E.subtotal.code}" (${E.subtotal.name})`,
      iceLine,
      `- IVA (crédito tributario, compras) → Débito "${E.iva.code}" (${E.iva.name})`,
      `- Total a pagar al proveedor → Crédito "${E.total.code}" (${E.total.name})`,
    ].join("\n");
  }

  // income
  return [
    `- Subtotal de ventas → **Crédito** "${I.subtotal.code}" (${I.subtotal.name})`,
    `- IVA por pagar (débitos fiscales) → **Crédito** "${I.iva.code}" (${I.iva.name})`,
    `- Total facturado (por cobrar) → **Débito** "${I.total.code}" (${I.total.name})`,
  ].join("\n");
}

function stripCodeFences(s: string) {
  return s
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toNum(n: unknown): number | null {
  if (n == null || n === "") return null;
  const v = typeof n === "string" ? Number.parseFloat(n) : (n as number);
  return Number.isFinite(v) ? round2(v) : null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Coerce raw AI objects to JournalEntry with safe defaults.
 */
function coerceEntries(raw: any[], forcedType: "expense" | "income", fallbackDate: string): JournalEntry[] {
  return raw
    .map((r) => {
      const debit = toNum(r?.debit);
      const credit = toNum(r?.credit);

      const je: JournalEntry = {
        date: (r?.date && typeof r.date === "string") ? r.date.slice(0, 10) : fallbackDate,
        description: String(r?.description ?? "").slice(0, 300) || "",
        account_code: String(r?.account_code ?? ""),
        account_name: String(r?.account_name ?? ""),
        debit: debit && debit > 0 ? debit : undefined,
        credit: credit && credit > 0 ? credit : undefined,
        type: (r?.type === "expense" || r?.type === "income") ? r.type : forcedType,
        invoice_number: r?.invoice_number ? String(r.invoice_number) : "",
        source: "ai",
      };

      // Enforce single-sided amount
      if (je.debit && je.credit) {
        if (je.debit >= je.credit) je.credit = undefined;
        else je.debit = undefined;
      }
      if (!je.debit && !je.credit) return null;

      return je;
    })
    .filter(Boolean) as JournalEntry[];
}

/**
 * Ensure names/codes match the UI account list, if provided.
 * If uiAccounts not provided, we still try to be consistent via name<->code resolution.
 */
function mapToUiChart(entries: JournalEntry[], uiAccounts?: { code: string; name: string }[]) {
  if (!uiAccounts || uiAccounts.length === 0) return entries;

  const { codeToName, nameToCode } = makeLookups(uiAccounts);

  return entries.map((e) => {
    let code = (e.account_code || "").trim();
    let name = (e.account_name || "").trim();

    // If we only got a name, resolve code from UI chart.
    if (!code && name) {
      const res = resolveByNameOrLabel(name, uiAccounts);
      if (res) {
        code = res.code;
        name = res.name;
      }
    }

    // If we have a code but name doesn't match our UI list, fix the name.
    if (code && (!name || codeToName.get(code) !== name)) {
      const nm = codeToName.get(code);
      if (nm) name = nm;
    }

    // If still nothing, last-try by name fuzzy
    if (!code && !name && e.account_name) {
      const res = resolveByNameOrLabel(e.account_name, uiAccounts);
      if (res) {
        code = res.code;
        name = res.name;
      }
    }

    return { ...e, account_code: code, account_name: name };
  });
}

/**
 * If totals differ by ≤ 0.01 (rounding noise), nudge the last non-zero line.
 */
function nudgeRounding(entries: JournalEntry[]) {
  const sum = entries.reduce(
    (acc, e) => {
      acc.debit += e.debit ?? 0;
      acc.credit += e.credit ?? 0;
      return acc;
    },
    { debit: 0, credit: 0 }
  );
  const diff = round2(sum.debit - sum.credit);

  if (Math.abs(diff) <= 0.01 && diff !== 0) {
    // Find last line with amount on the larger side and nudge it down
    const adjustSide: "debit" | "credit" = diff > 0 ? "debit" : "credit";
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (adjustSide === "debit" && e.debit) {
        entries[i] = { ...e, debit: round2((e.debit ?? 0) - diff) };
        break;
      }
      if (adjustSide === "credit" && e.credit) {
        entries[i] = { ...e, credit: round2((e.credit ?? 0) + diff) };
        break;
      }
    }
  }
  return entries;
}