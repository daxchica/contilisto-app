import { doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "@/firebase-config";

/* ---------------- AUTH ---------------- */

export function getUidOrThrow(): string {
  const uid = getAuth().currentUser?.uid;
  if (!uid) {
    const err: any = new Error("Not authenticated");
    err.code = "unauthenticated";
    throw err;
  }
  return uid;
}

/* ---------------- ENTITY ACCESS ---------------- */

export async function assertEntityMember(entityId: string): Promise<void> {
  const uid = getUidOrThrow();

  const memberRef = doc(db, "entities", entityId, "members", uid);
  const snap = await getDoc(memberRef);

  if (!snap.exists()) {
    const err: any = new Error("User is not a member of this entity");
    err.code = "permission-denied";
    throw err;
  }
}