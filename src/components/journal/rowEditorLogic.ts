// ============================================================================
// src/components/journal/rowEditorLogic.ts
// Shared row-engine used by ManualEntryModal + JournalPreviewModal
// - Add / duplicate / delete rows
// - Debit/Credit raw formatting with blur cleanup
// - Enter navigation (debit -> credit -> next row debit)
// - Canonical PUC normalization via canonicalPair + normalizeEntry
// - Firestore-safe (no undefined for required numeric fields)
// ============================================================================

import { v4 as uuidv4 } from "uuid";
import type { Account } from "@/types/AccountTypes";
import type { JournalEntry } from "@/types/JournalEntry";
import { canonicalPair, normalizeEntry } from "@/utils/accountPUCMap";

export type Row = Omit<JournalEntry, "thirdParty" | "documentRef"> & {
  thirdParty?: string | null;
  documentRef?: string | null;
  requiresThirdParty?: boolean;
  _debitRaw?: string;
  _creditRaw?: string;
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function createEmptyRow(
  entityId: string,
  userId: string,
  defaults?: Partial<Row>
): Row {
  return {
    id: uuidv4(),
    account_code: "",
    account_name: "",
    debit: 0,
    credit: 0,
    description: "",
    entityId,
    userId,
    date: todayISO(),
    source: "manual",
    isManual: true,
    createdAt: Date.now(),
    thirdParty: null,
    documentRef: null,
    requiresThirdParty: false,
    ...defaults,
  };
}

export function calcTotals(rows: Row[]) {
  const debit = rows.reduce((s, r) => s + (Number(r.debit) || 0), 0);
  const credit = rows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
  const diff = +(debit - credit).toFixed(2);
  return {
    debit: +debit.toFixed(2),
    credit: +credit.toFixed(2),
    diff,
    isBalanced: Math.abs(diff) < 0.01 && debit > 0 && credit > 0,
  };
}

/**
 * Patch row with canonical normalization
 */
export function patchRowFactory(
  getAccountsByCode: () => Map<string, Account>,
  setRows: React.Dispatch<React.SetStateAction<Row[]>>
) {
  return (idx: number, patch: Partial<Row>) => {
    setRows((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };

      // Normalize account code/name using your canonical logic
      const canon = normalizeEntry({
        account_code: merged.account_code,
        account_name: merged.account_name,
      });

      next[idx] = {
        ...merged,
        account_code: canon.account_code,
        account_name: canon.account_name,
      };

      return next;
    });
  };
}

/**
 * Apply account selection using canonicalPair
 */
export function applyAccountFactory(
  patchRow: (idx: number, patch: Partial<Row>) => void
) {
  return (idx: number, acc: { code: string; name: string } | null) => {
    if (!acc) return;
    const canon = canonicalPair(acc);
    patchRow(idx, { account_code: canon.code, account_name: canon.name });
  };
}

// ---------------------------------------------
// Numeric input helpers (raw formatting)
// ---------------------------------------------

export function parseDecimalLoose(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return 0;
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return null;
  return num;
}

export function formatMoney(num: number): string {
  if (!num || Number.isNaN(num)) return "";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function debitValueForInput(r: Row): string {
  return (
    r._debitRaw ??
    ((r.debit ?? 0) !== 0
      ? Number(r.debit).toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      : "")
  );
}

export function creditValueForInput(r: Row): string {
  return (
    r._creditRaw ??
    ((r.credit ?? 0) !== 0
      ? Number(r.credit).toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      : "")
  );
}

// ---------------------------------------------
// Keyboard navigation helpers
// ---------------------------------------------

export function focusInput(selector: string) {
  const el = document.querySelector<HTMLInputElement>(selector);
  el?.focus();
}

export function handleEnterFromDebit(
  ev: React.KeyboardEvent,
  idx: number
) {
  if (ev.key !== "Enter") return;
  ev.preventDefault();
  focusInput(`[data-credit="${idx}"]`);
}

export function handleEnterFromCredit(
  ev: React.KeyboardEvent,
  idx: number,
  addRow: () => void
) {
  if (ev.key !== "Enter") return;
  ev.preventDefault();

  // Try next row debit
  const nextSelector = `[data-debit="${idx + 1}"]`;
  const next = document.querySelector<HTMLInputElement>(nextSelector);

  if (next) {
    next.focus();
    return;
  }

  // If last row, add new row and focus it
  addRow();
  setTimeout(() => {
    focusInput(`[data-debit="${idx + 1}"]`);
  }, 100);
}

// ---------------------------------------------
// Row operations
// ---------------------------------------------

export function addRowFactory(
  entityId: string,
  userId: string,
  setRows: React.Dispatch<React.SetStateAction<Row[]>>
) {
  return () => setRows((prev) => [...prev, createEmptyRow(entityId, userId)]);
}

export function removeRowFactory(
  setRows: React.Dispatch<React.SetStateAction<Row[]>>,
  getSelectedIdx: () => number | null,
  setSelectedIdx: React.Dispatch<React.SetStateAction<number | null>>
) {
  return (idx: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== idx);
      return next;
    });

    const selectedIdx = getSelectedIdx();
    if (selectedIdx === idx) setSelectedIdx(null);
  };
}

export function duplicateRowFactory(
  setRows: React.Dispatch<React.SetStateAction<Row[]>>,
  getSelectedIdx: () => number | null,
  setSelectedIdx: React.Dispatch<React.SetStateAction<number | null>>,
  getRowsSnapshot: () => Row[]
) {
  return () => {
    const selectedIdx = getSelectedIdx();
    if (selectedIdx == null) return;

    const rows = getRowsSnapshot();
    const base = rows[selectedIdx];
    if (!base) return;

    const copy: Row = {
      ...base,
      id: uuidv4(),
      createdAt: Date.now(),
      _debitRaw: base._debitRaw,
      _creditRaw: base._creditRaw,
    };

    setRows((prev) => {
      const next = [...prev];
      next.splice(selectedIdx + 1, 0, copy);
      return next;
    });

    setSelectedIdx(selectedIdx + 1);
  };
}