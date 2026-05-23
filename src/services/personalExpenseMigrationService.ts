// ============================================================================
// src/services/personalExpenseMigrationService.ts
// CONTILISTO — One-time migration: moves personal expense journal entries
// that were saved to journalEntries (before the routing fix) into the
// dedicated personalExpenses sub-collection and cleans up their side-effects.
//
// Safe to call on every entity load — a Firestore flag prevents re-runs.
// ============================================================================

import { db } from "@/firebase-config";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";

import type { JournalEntry } from "@/types/JournalEntry";
import type { PersonalExpenseRecord } from "@/types/PersonalExpenseRecord";
import type { SriCategoryKey } from "./personalExpensesService";
import { SRI_CATEGORIES } from "./personalExpensesService";
import {
  savePersonalExpenseRecord,
  personalExpenseExistsForInvoice,
} from "./personalExpenseStorageService";
import { updateAccountBalancesFromJournalEntries } from "./accountBalanceService";
import { requireEntityId } from "./requireEntityId";

// ============================================================================
// HELPERS (mirrors journalService logic, kept local to avoid circular import)
// ============================================================================

const PERSONAL_TAG_RE = /^\[Personal:\s*([^\]]+)\]/i;
const n2 = (x: unknown) =>
  Number.isFinite(Number(x)) ? Number(Number(x).toFixed(2)) : 0;
const norm = (c?: string) => (c || "").replace(/\./g, "").trim();

function isPersonalTransaction(entries: JournalEntry[]): boolean {
  return entries.some((e) => PERSONAL_TAG_RE.test(e.description ?? ""));
}

function extractRecord(
  entries: JournalEntry[],
  entityId: string,
  uid: string
): PersonalExpenseRecord {
  let category: SriCategoryKey = "Otros";
  let rawDescription = "";

  for (const e of entries) {
    const m = PERSONAL_TAG_RE.exec(e.description ?? "");
    if (m) {
      const key = m[1].trim();
      const found = SRI_CATEGORIES.find(
        (c) => c.key.toLowerCase() === key.toLowerCase()
      );
      category = (found?.key ?? "Otros") as SriCategoryKey;
      rawDescription = (e.description ?? "").replace(PERSONAL_TAG_RE, "").trim();
      break;
    }
  }

  // Base: sum of 5xx / 6xx debit lines
  let amount = n2(
    entries
      .filter((e) => {
        const code = norm(e.account_code);
        return (code.startsWith("5") || code.startsWith("6")) && n2(e.debit) > 0;
      })
      .reduce((s, e) => s + n2(e.debit), 0)
  );

  // IVA: 133xxx debits
  const iva = n2(
    entries
      .filter((e) => norm(e.account_code).startsWith("133") && n2(e.debit) > 0)
      .reduce((s, e) => s + n2(e.debit), 0)
  );

  // Fallback when no 5xx/6xx lines
  if (amount === 0) {
    amount = n2(
      entries
        .filter((e) => {
          const code = norm(e.account_code);
          return (
            n2(e.debit) > 0 &&
            !code.startsWith("1") &&
            !code.startsWith("133")
          );
        })
        .reduce((s, e) => s + n2(e.debit), 0)
    );
  }

  const first = entries[0];
  const invoiceNumber = first.invoice_number ?? "";

  return {
    id: crypto.randomUUID(),
    entityId,
    uid,
    transactionId: first.transactionId,
    invoice_number: invoiceNumber,
    invoice_number_normalized: invoiceNumber.replace(/\s+/g, "").toUpperCase(),
    date: String(first.date ?? "").slice(0, 10),
    category,
    description: rawDescription,
    supplierName:
      first.supplier_name ?? first.issuerName ?? first.customer_name ?? "-",
    supplierRUC:
      first.supplier_ruc ?? first.issuerRUC ?? first.buyerRUC ?? "-",
    amount,
    iva,
    total: n2(amount + iva),
    createdAt: Date.now(),
  };
}

// ============================================================================
// MIGRATION
// ============================================================================

/**
 * Finds all journal entries tagged [Personal: X] for this entity,
 * moves them to personalExpenses, reverses their account-balance impact,
 * and removes any AP payable that was created for them.
 *
 * Idempotent — a Firestore flag (entities/{id}/meta/personalExpenseMigration)
 * prevents the migration from running more than once per entity.
 *
 * @returns number of transactions migrated (0 if already done or nothing found)
 */
export async function migratePersonalExpensesFromJournal(
  entityId: string,
  uid: string
): Promise<number> {
  requireEntityId(entityId, "migración gastos personales");

  // ── Guard: already migrated? ─────────────────────────────────────────────
  const flagRef = doc(
    db,
    "entities",
    entityId,
    "meta",
    "personalExpenseMigration"
  );
  const flagSnap = await getDoc(flagRef);
  if (flagSnap.exists() && flagSnap.data()?.done === true) return 0;

  // ── Fetch all journal entries ─────────────────────────────────────────────
  const col = collection(db, "entities", entityId, "journalEntries");
  const snap = await getDocs(col);

  if (snap.empty) {
    await setDoc(flagRef, { done: true, migrated: 0, migratedAt: Date.now() });
    return 0;
  }

  const allEntries: JournalEntry[] = snap.docs.map((d) => ({
    ...(d.data() as JournalEntry),
    id: d.id,
  }));

  // ── Group by transactionId ────────────────────────────────────────────────
  const txMap = new Map<string, JournalEntry[]>();
  for (const e of allEntries) {
    const tx = e.transactionId || "";
    if (!tx) continue;
    if (!txMap.has(tx)) txMap.set(tx, []);
    txMap.get(tx)!.push(e);
  }

  let migrated = 0;

  for (const [txId, txEntries] of txMap) {
    if (!isPersonalTransaction(txEntries)) continue;

    // ── 1. Save to personalExpenses (skip if already there) ──────────────
    const invoiceNumber = txEntries[0]?.invoice_number ?? "";
    const normalized = invoiceNumber.replace(/\s+/g, "").toUpperCase();

    const alreadyMoved = normalized
      ? await personalExpenseExistsForInvoice(entityId, normalized)
      : false;

    if (!alreadyMoved) {
      const record = extractRecord(txEntries, entityId, uid);
      await savePersonalExpenseRecord(entityId, record);
    }

    // ── 2. Reverse account-balance impact ─────────────────────────────────
    // Pass negated debit/credit so the balance service subtracts what was
    // previously added when these entries were saved.
    const reversedEntries = txEntries.map((e) => ({
      ...e,
      debit:  -n2(e.debit),
      credit: -n2(e.credit),
    })) as JournalEntry[];

    await updateAccountBalancesFromJournalEntries(entityId, reversedEntries);

    // ── 3. Delete from journalEntries ─────────────────────────────────────
    const batch = writeBatch(db);
    for (const e of txEntries) {
      if (e.id) batch.delete(doc(col, e.id));
    }
    await batch.commit();

    // ── 4. Delete AP payable (only if unpaid — no cascade needed) ─────────
    const payableRef = doc(db, "entities", entityId, "payables", txId);
    const payableSnap = await getDoc(payableRef);
    if (payableSnap.exists()) {
      const p = payableSnap.data();
      const payments: string[] = Array.isArray(p.paymentTransactionIds)
        ? p.paymentTransactionIds
        : [];
      if (payments.length === 0) {
        await deleteDoc(payableRef);
      }
      // If there are payments, leave the payable untouched for safety.
    }

    migrated++;
    console.log(`🧹 Migrated personal expense tx ${txId} (${invoiceNumber})`);
  }

  // ── Mark complete ─────────────────────────────────────────────────────────
  await setDoc(flagRef, {
    done:       true,
    migrated,
    migratedAt: Date.now(),
  });

  if (migrated > 0) {
    console.log(`✅ personalExpenses migration: ${migrated} transaction(s) moved.`);
  }

  return migrated;
}
