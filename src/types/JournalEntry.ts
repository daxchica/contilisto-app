// src/types/JournalEntry.ts

export type EntryKind = "income" | "expense" | "asset" | "liability" | "equity";
export type EntrySource = "ai" | "manual" | "edited";

/** Journal line stored in cents for perfect math */
export interface JournalEntry {
    /** Firestore doc id (when fetched) */
    id?: string;

    /** ISO date YYYY-MM-DD */
    date: string;

    /** Free text; typically vendor/customer or memo */
    description?: string;

    /** PUC code and name chosen for this line */
    account_code: string;
    account_name: string;

    /** Exactly one of debit/credit must be > 0; keep 2-decimal numbers */
    debit?: number; // e.g., 123.45
    credit?: number; // e.g., 123.45

    /** For high-level classification (used by you UI and AI). */
    type?: EntryKind; // "income" | "expense" | "liability";

    /** Optional invoice linkage */
    invoice_number?: string;

    /** All lines generated together share this */
    transactionId?: string;

    /** Auth metadata (keep userId; uid deprecated for consistency) */
    uid?: string; // legacy alias; prefer userId
    userId?: string;

    /** Provenance and manual edit flags */
  source?: EntrySource;     // "ai" | "manual" | "edited"
  manual?: boolean;         // true when user added/edited the line

  /** Audit fields (epoch ms) */
  createdAt?: number;
  editedAt?: number;
  editedBy?: string;

  /** Optional vendor/customer RUC to aid learning */
  counterpartyRUC?: string;

}

/** helper converters */
export const toCents = (x: number | undefined) =>
  typeof x === "number" ? Math.round(x * 100) : 0;
export const fromCents = (c: number | undefined) =>
  typeof c === "number" ? c / 100 : 0;

export function isBalanced(lines: Pick<JournalEntry, "debit" | "credit">[]) {
  const d = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const c = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  return Math.abs(d - c) < 0.01;    
}


