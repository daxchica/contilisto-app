// src/utils/buildJournalEntry.ts

import type { JournalEntry, EntrySource } from "@/types/JournalEntry";

export function buildJournalEntry(params: Partial<JournalEntry>): JournalEntry {
  if (!params.entityId) throw new Error("entityId requerido");
  if (!params.account_code) throw new Error("account_code requerido");

  return {
    id: params.id ?? crypto.randomUUID(),

    entityId: params.entityId,
    uid: params.uid ?? "",

    transactionId: params.transactionId ?? crypto.randomUUID(),

    // 🔥 DEFAULTS (KEY FIX)
    transactionType: params.transactionType ?? "invoice",
    documentNature: params.documentNature ?? "sale",

    account_code: params.account_code,
    account_name: params.account_name ?? "",

    debit: Number(params.debit ?? 0),
    credit: Number(params.credit ?? 0),

    description: params.description ?? "",
    date: params.date ?? new Date().toISOString().slice(0, 10),

    invoice_number: params.invoice_number ?? "",

    source: (params.source ?? "manual") as EntrySource,

    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}