import { db } from "@/firebase-config";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

export interface SriSettings {
    ambiente: "1" | "2";
    estab: string;
    ptoEmi: string;
    secuencialActual: number;
    p12?: {
        storagePath: string;
        fileName?: string;
        uploadedAt?: any;
    };
    updatedAt?: any;
}

/* ======================================================
 * FETCH SRI SETTINGS (from entity root)
 * ====================================================== */
export async function fetchSriSettings(entityId: string): Promise<SriSettings | null> {
  if (!entityId) throw new Error("entityId requerido");

  const ref = doc(db, "entities", entityId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data();
  return (data.sriSettings ?? null) as SriSettings | null;
}

/* ======================================================
 * SAVE / UPDATE SRI SETTINGS (MERGE SAFE)
 * ====================================================== */
export async function saveSriSettings(
  entityId: string,
  data: Partial<SriSettings>,
  updatedBy?: string
) {
  if (!entityId) throw new Error("entityId requerido");

  const ref = doc(db, "entities", entityId);

  await updateDoc(ref, {
    sriSettings: {
      ...data,
      updatedAt: serverTimestamp(),
      ...(updatedBy ? { updatedBy } : {}),
    },
    updatedAt: serverTimestamp(),
  });
}