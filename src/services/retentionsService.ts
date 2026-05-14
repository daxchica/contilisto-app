import { db } from "@/firebase-config";
import { collection, addDoc, doc, getDoc, setDoc } from "firebase/firestore";

export async function saveRetention(
  entityId: string,
  data: any
) {
  const ref = collection(db, "entities", entityId, "retentions");
  await addDoc(ref, data);
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