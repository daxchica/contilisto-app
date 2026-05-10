// ============================================================================
// src/services/journalCounterService.ts
// Atomic sequential journal ID generator — Firestore transaction-based.
// Counter document: entities/{entityId}/counters/journal  { nextId: number }
// Format: AS-00001 (prefix "AS" = Asiento, zero-padded to 5 digits)
// ============================================================================

import { db } from "@/firebase-config";
import { doc, runTransaction } from "firebase/firestore";

const COUNTER_DOC = "journal";
const PREFIX      = "AS";
const PAD         = 5;

/**
 * Atomically increments the per-entity journal counter and returns the next
 * formatted ID (e.g. "AS-00042").  Safe under concurrent writes.
 */
export async function getNextJournalId(entityId: string): Promise<string> {
  if (!entityId?.trim()) throw new Error("entityId required for journal counter");

  const counterRef = doc(db, "entities", entityId, "counters", COUNTER_DOC);

  const nextId = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current: number = snap.exists() ? (snap.data().nextId as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { nextId: next });
    return next;
  });

  return `${PREFIX}-${String(nextId).padStart(PAD, "0")}`;
}
