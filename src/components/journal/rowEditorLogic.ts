// ============================================================================
// src/components/journal/rowEditorLogic.ts
// Shared row-engine used by ManualEntryModal + JournalPreviewModal
// PRODUCTION HARDENED VERSION
// ============================================================================

import React from "react";
import { v4 as uuidv4 } from "uuid";

import type { Account } from "@/types/AccountTypes";
import type { JournalEntry } from "@/types/JournalEntry";

import { canonicalPair, normalizeEntry } from "@/utils/accountPUCMap";

/* =============================================================================
   TYPES
============================================================================= */

export type Row = Omit<JournalEntry, "thirdParty" | "documentRef"> & {
  thirdParty?: string | null;
  documentRef?: string | null;
  requiresThirdParty?: boolean;

  // UI-only fields
  _debitRaw?: string;
  _creditRaw?: string;
};

/* =============================================================================
   CONSTANTS
============================================================================= */

export const todayISO = () => new Date().toISOString().slice(0, 10);

/* =============================================================================
   CORE ROW FACTORY (CRITICAL)
============================================================================= */

export function createEmptyRow(
  entityId: string,
  userIdSafe: string,
  defaults?: Partial<Row>
): Row {
  const baseTransactionId = defaults?.transactionId ?? uuidv4();

  return {
    id: uuidv4(),

    entityId,
    uid: userIdSafe,

    transactionId: baseTransactionId,
    transactionType: defaults?.transactionType ?? "invoice",
    documentNature: defaults?.documentNature ?? "sale",

    account_code: "",
    account_name: "",

    debit: 0,
    credit: 0,

    description: "",
    date: todayISO(),

    source: "manual",
    isManual: true,

    createdAt: Date.now(),

    thirdParty: null,
    documentRef: null,
    requiresThirdParty: false,

    ...defaults, // 👈 applied last but safe due to enforced fields above
  };
}

/* =============================================================================
   TOTALS
============================================================================= */

export function calcTotals(rows: Row[]) {
  const debit = rows.reduce((s, r) => s + Number(r.debit ?? 0), 0);
  const credit = rows.reduce((s, r) => s + Number(r.credit ?? 0), 0);

  const diff = +(debit - credit).toFixed(2);

  return {
    debit: +debit.toFixed(2),
    credit: +credit.toFixed(2),
    diff,
    isBalanced: Math.abs(diff) < 0.01 && debit > 0 && credit > 0,
  };
}

/* =============================================================================
   PATCH ROW (SAFE NORMALIZATION)
============================================================================= */

export function patchRowFactory(
  getAccountsByCode: () => Map<string, Account>,
  setRows: React.Dispatch<React.SetStateAction<Row[]>>
) {
  return (idx: number, patch: Partial<Row>) => {
    setRows((prev) => {
      const current = prev[idx];
      if (!current) return prev;

      const next = [...prev];

      const merged: Row = {
        ...current,
        ...patch,
      };

      const canon = normalizeEntry({
        account_code: merged.account_code,
        account_name: merged.account_name,
      });

      next[idx] = {
        ...merged,
        account_code: canon.account_code,
        account_name: canon.account_name,
        debit: Number(merged.debit ?? 0),
        credit: Number(merged.credit ?? 0),
      };

      return next;
    });
  };
}

/* =============================================================================
   ACCOUNT SELECTION
============================================================================= */

export function applyAccountFactory(
  patchRow: (idx: number, patch: Partial<Row>) => void
) {
  return (idx: number, acc: { code: string; name: string } | null) => {
    if (!acc) return;

    const canon = canonicalPair(acc);

    patchRow(idx, {
      account_code: canon.code,
      account_name: canon.name,
    });
  };
}

/* =============================================================================
   NUMERIC HELPERS
============================================================================= */

export function parseDecimalLoose(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return 0;

  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

export function formatMoney(num: number): string {
  if (!num || Number.isNaN(num)) return "";

  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* =============================================================================
   INPUT FORMATTERS
============================================================================= */

export function debitValueForInput(r: Row): string {
  return (
    r._debitRaw ??
    (Number(r.debit ?? 0) !== 0
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
    (Number(r.credit ?? 0) !== 0
      ? Number(r.credit).toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      : "")
  );
}

/* =============================================================================
   KEYBOARD NAVIGATION
============================================================================= */

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

  const nextSelector = `[data-debit="${idx + 1}"]`;
  const next = document.querySelector<HTMLInputElement>(nextSelector);

  if (next) {
    next.focus();
    return;
  }

  addRow();

  setTimeout(() => {
    focusInput(`[data-debit="${idx + 1}"]`);
  }, 100);
}

/* =============================================================================
   ROW OPERATIONS
============================================================================= */

export function addRowFactory(
  entityId: string,
  userIdSafe: string,
  setRows: React.Dispatch<React.SetStateAction<Row[]>>
) {
  return () =>
    setRows((prev) => {
      const base = prev[0];

      return [
        ...prev,
        createEmptyRow(entityId, userIdSafe, {
          transactionId: base?.transactionId ?? uuidv4(),
          transactionType: base?.transactionType ?? "invoice",
          documentNature: base?.documentNature ?? "sale",
        }),
      ];
    });
}

export function removeRowFactory(
  setRows: React.Dispatch<React.SetStateAction<Row[]>>,
  getSelectedIdx: () => number | null,
  setSelectedIdx: React.Dispatch<React.SetStateAction<number | null>>
) {
  return (idx: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx);
    });

    if (getSelectedIdx() === idx) {
      setSelectedIdx(null);
    }
  };
}

export function duplicateRowFactory(
  setRows: React.Dispatch<React.SetStateAction<Row[]>>,
  getSelectedIdx: () => number | null,
  setSelectedIdx: React.Dispatch<React.SetStateAction<number | null>>,
  getRowsSnapshot: () => Row[]
) {
  return () => {
    const idx = getSelectedIdx();
    if (idx == null) return;

    const rows = getRowsSnapshot();
    const base = rows[idx];
    if (!base) return;

    const copy: Row = {
      ...base,
      id: uuidv4(),

      transactionId: base.transactionId,
      transactionType: base.transactionType,
      documentNature: base.documentNature,

      debit: Number(base.debit ?? 0),
      credit: Number(base.credit ?? 0),

      createdAt: Date.now(),

      _debitRaw: base._debitRaw,
      _creditRaw: base._creditRaw,
    };

    setRows((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });

    setSelectedIdx(idx + 1);
  };
}