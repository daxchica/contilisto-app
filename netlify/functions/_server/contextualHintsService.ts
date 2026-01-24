import { adminDb } from "../_server/firebaseAdmin";
import { normalizeConcept } from "./utils/normalizeConcept";

export type ContextualHint = {
  uid: string;
  supplierRUC: string;
  supplierName?: string;

  concept: string;              // normalized concept
  accountCode: string;
  accountName: string;

  frequency: number;            // how many times user confirmed this
  createdAt: number;
  updatedAt?: number;
};

/**
 * SAFE contextual account hint.
 * Returns ONLY high-confidence suggestions.
 */
export async function getContextualHint(
  uid: string,
  supplierRUC: string,
  rawConcept?: string
): Promise<{ accountCode: string; accountName: string } | null> {
  try {
    if (!uid || !supplierRUC || !rawConcept) return null;

    const cleanRUC = supplierRUC.replace(/\D/g, "");
    if (cleanRUC.length !== 13) return null;

    const concept = normalizeConcept(rawConcept);
    if (!concept || concept.length < 4) return null;

    const docId = `${uid}__${cleanRUC}__${concept}`;
    const ref = adminDb.collection("contextualAccountHints").doc(docId);
    const snap = await ref.get();

    if (!snap.exists) return null;

    const data = snap.data() as ContextualHint | undefined;
    if (!data) return null;

    // 🔐 Confidence gate
    if (!data.accountCode || !data.accountName) return null;
    if ((data.frequency ?? 0) < 2) return null;

    // 🚫 Never override control / tax accounts
    if (
      data.accountCode.startsWith("133") || // IVA
      data.accountCode.startsWith("201") || // Proveedores
      data.accountCode.startsWith("213")    // IVA ventas
    ) {
      return null;
    }

    // 🚫 Avoid generic trash learning
    const genericNames = [
      "GASTOS VARIOS",
      "GASTOS GENERALES",
      "OTROS GASTOS",
      "SERVICIOS GENERALES",
    ];

    if (
      genericNames.some((g) =>
        data.accountName.toUpperCase().includes(g)
      )
    ) {
      return null;
    }

    return {
      accountCode: data.accountCode,
      accountName: data.accountName,
    };
  } catch (err) {
    // ⚠️ Contextual hints must NEVER break OCR flow
    console.warn("⚠️ getContextualHint skipped:", err);
    return null;
  }
}