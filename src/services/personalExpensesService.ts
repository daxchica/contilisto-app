// ============================================================================
// src/services/personalExpensesService.ts
// CONTILISTO — Reporte de Gastos Personales (SRI Ecuador)
//
// Two entry points:
//  • buildPersonalExpenseReport()         — legacy: parses old JournalEntries
//                                           tagged [Personal: X] (backward compat)
//  • buildPersonalExpenseReportFromRecords() — new: reads PersonalExpenseRecord[]
//                                              from the dedicated Firestore collection
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";
import type { PersonalExpenseRecord } from "@/types/PersonalExpenseRecord";

/* =============================================================================
   SRI CATEGORIES (Formulario de Gastos Personales — Decreto 374)
============================================================================= */

/**
 * Categorías oficiales del Formulario de Gastos Personales (Formulario GP)
 * según la Ley Orgánica de Régimen Tributario Interno (LORTI) y
 * resoluciones vigentes del SRI Ecuador.
 *
 * Nota: Estos gastos son NO DEDUCIBLES para la empresa (persona jurídica).
 * Para la persona natural contribuyente, pueden aplicarse en el
 * Formulario GP de declaración de impuesto a la renta personal.
 */
export const SRI_CATEGORIES = [
  { key: "Vivienda",     label: "Vivienda",                  icon: "🏠", color: "blue"   },
  { key: "Salud",        label: "Salud",                     icon: "🏥", color: "red"    },
  { key: "Alimentación", label: "Alimentación",              icon: "🍽️", color: "green"  },
  { key: "Educación",    label: "Educación, Arte y Cultura", icon: "📚", color: "yellow" },
  { key: "Vestimenta",   label: "Vestimenta",                icon: "👗", color: "purple" },
  { key: "Turismo",      label: "Turismo Nacional",          icon: "✈️", color: "cyan"   },
  { key: "Otros",        label: "Otros",                     icon: "📋", color: "gray"   },
] as const;

export type SriCategoryKey = typeof SRI_CATEGORIES[number]["key"];

/* =============================================================================
   TYPES
============================================================================= */

export interface PersonalExpenseLine {
  transactionId: string;
  date: string;
  invoiceNumber: string;
  supplierName: string;
  supplierRUC: string;
  category: SriCategoryKey;
  amount: number;       // taxable base (sum of 5xx/6xx debits)
  iva: number;          // IVA amount (sum of 133xxx debits)
  total: number;        // amount + iva
  description: string;  // original note (without the [Personal:...] tag)
}

export interface PersonalExpenseGroup {
  category: SriCategoryKey;
  label: string;
  icon: string;
  color: string;
  lines: PersonalExpenseLine[];
  subtotal: number;
  subtotalIva: number;
  subtotalTotal: number;
}

export interface PersonalExpenseReport {
  year: number;
  groups: PersonalExpenseGroup[];
  grandTotal: number;
  grandTotalIva: number;
  grandTotalWithIva: number;
  lineCount: number;
}

/* =============================================================================
   HELPERS
============================================================================= */

const PERSONAL_TAG_RE = /^\[Personal:\s*([^\]]+)\]/i;

function n2(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function parsePersonalTag(description: string): SriCategoryKey | null {
  const m = PERSONAL_TAG_RE.exec(description ?? "");
  if (!m) return null;
  const raw = m[1].trim();
  // Map to official SRI category key (case-insensitive, accent-tolerant).
  // Legacy tags like "Transporte" or "Entretenimiento" that were removed from
  // the official list fall back to "Otros" automatically.
  const found = SRI_CATEGORIES.find(
    (c) => c.key.toLowerCase() === raw.toLowerCase()
  );
  return (found?.key ?? "Otros") as SriCategoryKey;
}

function stripPersonalTag(description: string): string {
  return description.replace(PERSONAL_TAG_RE, "").trim();
}

/* =============================================================================
   MAIN FUNCTION
============================================================================= */

export function buildPersonalExpenseReport(
  allEntries: JournalEntry[],
  entityId: string,
  year: number
): PersonalExpenseReport {
  const startOfYear = `${year}-01-01`;
  const endOfYear   = `${year}-12-31`;

  // ── Filter to this entity + year, non-initial ──────────────────────────
  const relevant = allEntries.filter((e) => {
    if (!e || e.entityId !== entityId) return false;
    if (e.source === "initial") return false;
    const d = String(e.date ?? "");
    return d >= startOfYear && d <= endOfYear;
  });

  // ── Group by transactionId ─────────────────────────────────────────────
  const txMap = new Map<string, JournalEntry[]>();
  for (const e of relevant) {
    const tx = e.transactionId || e.transaction_id || "";
    if (!tx) continue;
    if (!txMap.has(tx)) txMap.set(tx, []);
    txMap.get(tx)!.push(e);
  }

  // ── For each transaction, check if ANY line is tagged [Personal:...] ──
  const lines: PersonalExpenseLine[] = [];

  for (const [txId, txLines] of txMap) {
    // Find the category from any tagged description in the transaction
    let category: SriCategoryKey | null = null;
    let rawDescription = "";

    for (const line of txLines) {
      const parsed = parsePersonalTag(line.description ?? "");
      if (parsed) {
        category = parsed;
        rawDescription = stripPersonalTag(line.description ?? "");
        break;
      }
    }

    if (!category) continue; // not a personal expense transaction

    const first = txLines[0];

    // Expense base: sum of 5xx and 6xx debit entries
    const amount = n2(
      txLines
        .filter((l) => {
          const code = (l.account_code ?? "").trim();
          return (code.startsWith("5") || code.startsWith("6")) && n2(l.debit) > 0;
        })
        .reduce((s, l) => s + n2(l.debit), 0)
    );

    // IVA: sum of 133xxx debit entries
    const iva = n2(
      txLines
        .filter((l) => (l.account_code ?? "").trim().startsWith("133") && n2(l.debit) > 0)
        .reduce((s, l) => s + n2(l.debit), 0)
    );

    // If no 5xx/6xx lines (e.g. direct bank payment tagged as personal),
    // fall back to the sum of debit lines excluding bank/IVA accounts
    const fallbackAmount =
      amount === 0
        ? n2(
            txLines
              .filter((l) => {
                const code = (l.account_code ?? "").trim();
                return (
                  n2(l.debit) > 0 &&
                  !code.startsWith("1") && // not asset
                  !code.startsWith("133")  // not IVA
                );
              })
              .reduce((s, l) => s + n2(l.debit), 0)
          )
        : 0;

    const finalAmount = amount > 0 ? amount : fallbackAmount;
    if (finalAmount <= 0) continue; // skip zero-amount transactions

    // Supplier / document metadata
    const supplierName =
      first.supplier_name ?? first.issuerName ?? first.customer_name ?? "-";
    const supplierRUC =
      first.supplier_ruc ?? first.issuerRUC ?? first.buyerRUC ?? "-";
    const invoiceNumber = first.invoice_number ?? "-";

    lines.push({
      transactionId: txId,
      date: String(first.date ?? "").slice(0, 10),
      invoiceNumber,
      supplierName,
      supplierRUC,
      category,
      amount: finalAmount,
      iva,
      total: n2(finalAmount + iva),
      description: rawDescription,
    });
  }

  // Sort lines by date within each category
  lines.sort((a, b) => {
    const catOrder = SRI_CATEGORIES.findIndex((c) => c.key === a.category) -
                     SRI_CATEGORIES.findIndex((c) => c.key === b.category);
    if (catOrder !== 0) return catOrder;
    return a.date.localeCompare(b.date);
  });

  // ── Build groups ───────────────────────────────────────────────────────
  const groups: PersonalExpenseGroup[] = SRI_CATEGORIES.map((cat) => {
    const catLines = lines.filter((l) => l.category === cat.key);
    return {
      category: cat.key as SriCategoryKey,
      label: cat.label,
      icon: cat.icon,
      color: cat.color,
      lines: catLines,
      subtotal:      n2(catLines.reduce((s, l) => s + l.amount, 0)),
      subtotalIva:   n2(catLines.reduce((s, l) => s + l.iva, 0)),
      subtotalTotal: n2(catLines.reduce((s, l) => s + l.total, 0)),
    };
  }).filter((g) => g.lines.length > 0); // hide empty categories

  const grandTotal        = n2(groups.reduce((s, g) => s + g.subtotal, 0));
  const grandTotalIva     = n2(groups.reduce((s, g) => s + g.subtotalIva, 0));
  const grandTotalWithIva = n2(groups.reduce((s, g) => s + g.subtotalTotal, 0));

  return {
    year,
    groups,
    grandTotal,
    grandTotalIva,
    grandTotalWithIva,
    lineCount: lines.length,
  };
}

/* =============================================================================
   NEW PATH — build report directly from PersonalExpenseRecord[]
   (records come from entities/{id}/personalExpenses collection)
============================================================================= */

export function buildPersonalExpenseReportFromRecords(
  records: PersonalExpenseRecord[],
  year: number
): PersonalExpenseReport {
  const startOfYear = `${year}-01-01`;
  const endOfYear   = `${year}-12-31`;

  // Normalize: categories removed from the official list map to "Otros"
  const validCategoryKeys = new Set(SRI_CATEGORIES.map((c) => c.key));

  const lines: PersonalExpenseLine[] = records
    .filter((r) => r.date >= startOfYear && r.date <= endOfYear && r.total > 0)
    .map((r) => ({
      transactionId: r.transactionId,
      date:          r.date,
      invoiceNumber: r.invoice_number,
      supplierName:  r.supplierName,
      supplierRUC:   r.supplierRUC,
      category:      (validCategoryKeys.has(r.category) ? r.category : "Otros") as SriCategoryKey,
      amount:        n2(r.amount),
      iva:           n2(r.iva),
      total:         n2(r.total),
      description:   r.description,
    }));

  lines.sort((a, b) => {
    const catOrder =
      SRI_CATEGORIES.findIndex((c) => c.key === a.category) -
      SRI_CATEGORIES.findIndex((c) => c.key === b.category);
    if (catOrder !== 0) return catOrder;
    return a.date.localeCompare(b.date);
  });

  const groups: PersonalExpenseGroup[] = SRI_CATEGORIES.map((cat) => {
    const catLines = lines.filter((l) => l.category === cat.key);
    return {
      category:      cat.key as SriCategoryKey,
      label:         cat.label,
      icon:          cat.icon,
      color:         cat.color,
      lines:         catLines,
      subtotal:      n2(catLines.reduce((s, l) => s + l.amount, 0)),
      subtotalIva:   n2(catLines.reduce((s, l) => s + l.iva, 0)),
      subtotalTotal: n2(catLines.reduce((s, l) => s + l.total, 0)),
    };
  }).filter((g) => g.lines.length > 0);

  const grandTotal        = n2(groups.reduce((s, g) => s + g.subtotal, 0));
  const grandTotalIva     = n2(groups.reduce((s, g) => s + g.subtotalIva, 0));
  const grandTotalWithIva = n2(groups.reduce((s, g) => s + g.subtotalTotal, 0));

  return {
    year,
    groups,
    grandTotal,
    grandTotalIva,
    grandTotalWithIva,
    lineCount: lines.length,
  };
}
