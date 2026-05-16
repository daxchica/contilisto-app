import { db } from "@/firebase-config";
import {
  collection, addDoc, doc, getDoc, setDoc,
  query, where, getDocs, limit,
} from "firebase/firestore";
import type { Payable } from "@/types/Payable";

export async function saveRetention(
  entityId: string,
  data: any
) {
  const ref = collection(db, "entities", entityId, "retentions");
  await addDoc(ref, data);
}

// ---------------------------------------------------------------------------
// PAYABLE LOOKUP — used when linking a retention XML to an existing payable
// ---------------------------------------------------------------------------

/** Normalize invoice number for comparison: remove spaces, dashes, leading zeros */
function normalizeInv(n: string): string {
  return n.replace(/[\s-]/g, "").replace(/^0+/, "");
}

/**
 * Find a payable by invoice number (case-insensitive, dash-normalized).
 * Returns the first match or null.
 */
export async function findPayableByInvoiceNumber(
  entityId: string,
  invoiceNumber: string
): Promise<Payable | null> {
  if (!entityId || !invoiceNumber) return null;

  const normalized = invoiceNumber.replace(/\s/g, "").trim();

  // Try exact match on stored normalized field first
  const colRef = collection(db, "entities", entityId, "payables");
  const q = query(
    colRef,
    where("invoiceNumberNormalized", "==", normalized.replace(/-/g, "")),
    limit(1)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as Payable;
  }

  // Fallback: scan all payables and compare normalized
  const allSnap = await getDocs(colRef);
  const normTarget = normalizeInv(invoiceNumber);
  for (const d of allSnap.docs) {
    const data = d.data() as Payable;
    const stored = normalizeInv(data.invoiceNumber ?? "");
    if (stored === normTarget) {
      return { id: d.id, ...data };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// RETENTION SEQUENCE NUMBER
// Stores the last used retention certificate number so the system can suggest
// the next one automatically.
// ---------------------------------------------------------------------------

const SEQ_DOC = "retentionSequence";

/** Returns the last saved retention cert number, or "" if none yet. */
export async function getLastRetentionCertNumber(entityId: string): Promise<string> {
  try {
    const ref = doc(db, "entities", entityId, "settings", SEQ_DOC);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data().lastCertNumber ?? "") : "";
  } catch {
    return "";
  }
}

/** Persist the cert number that was just used so next call can suggest +1. */
export async function saveLastRetentionCertNumber(
  entityId: string,
  certNumber: string
): Promise<void> {
  try {
    const ref = doc(db, "entities", entityId, "settings", SEQ_DOC);
    await setDoc(ref, { lastCertNumber: certNumber }, { merge: true });
  } catch {
    // non-blocking
  }
}

/**
 * Given a cert number like "001-001-000000007", returns "001-001-000000008".
 * If the format is unrecognised, returns "".
 */
export function suggestNextCertNumber(last: string): string {
  if (!last) return "";
  // Format: AAA-BBB-NNNNNNNNN  (3-3-9 digits separated by dashes)
  const m = last.match(/^(\d{3}-\d{3}-)(\d+)$/);
  if (!m) return "";
  const prefix = m[1];
  const seq = Number(m[2]) + 1;
  return `${prefix}${String(seq).padStart(m[2].length, "0")}`;
}