// src/types/JournalEntry.ts

export type EntryKind = "income" | "expense" | "asset" | "liability" | "equity";
export type EntrySource = "ai" | "ai-layout" | "manual" | "edited" | "initial";

/** Journal line stored in cents for perfect math */
export interface JournalEntry {
    /** Firestore doc id (when fetched) */
    id?: string;
    entityId?: string;
    userId?: string;
    account_code: string;
    debit?: number; // e.g., 123.45
    credit?: number; // e.g., 123.45
    date?: string;
    createdAt?: number;
    description: string;
    account_name: string;
    type?: EntryKind; // "income" | "expense" | "liability";
    invoice_number?: string;
    transactionId?: string;
    uid?: string; // legacy alias; prefer userId
    source?: EntrySource;
    isManual?: boolean;         // true when user added/edited the line
    editedAt?: number;
    editedBy?: string;
    origin?: string;
    note?: string;
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

export function getBalanceDifference(lines: Pick<JournalEntry, "debit" | "credit">[]) {
  const d = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const c = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  return d - c;
}

export function assertValidEntry(entry: JournalEntry): void {
  const hasDebit = typeof entry.debit === "number" && entry.debit > 0;
  const hasCredit = typeof entry.credit === "number" && entry.credit > 0;
  if (hasDebit === hasCredit) {
    throw new Error("Invalid entry: exactly one of debit or credit must be > 0");
  }
}

