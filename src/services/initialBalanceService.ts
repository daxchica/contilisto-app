// src/services/initialBalanceService.ts

import { getFirestore, doc, getDocs, collection, writeBatch } from "firebase/firestore";
import { auth } from "@/firebase-config";
import { update } from "@react-spring/web";

const db = getFirestore();

export type InitialBalance = {
    account_code: string;
    account_name: string;
    initial_balance: number;
    type?: "debit" | "credit";
};

/**
 * Save per entity initial balance.
 * @param entityId - entity ID
 * @param balances - initial balance: [{ account_code, account_name, initial_balance }]
 */
export async function saveInitialBalances(
  entityId: string,
  balances: InitialBalance[]
): Promise<void> {
  const userIdSafe = auth.currentUser?.uid;

  if (!userIdSafe) throw new Error("User not authenticated");

  const batch = writeBatch(db);
  const now = new Date();

  balances.forEach((b) => {
    const code = b.account_code.trim();
    if (!code) return;

    const raw = Number(b.initial_balance);
    if (!Number.isFinite(raw) || raw === 0) return;

    const type: "debit" | "credit" = raw >= 0 ? "debit" : "credit";
    const absValue = Math.abs(raw);

    const ref = doc(db, "entities", entityId, "initialBalances", code);

    batch.set(
      ref,
      {
        account_code: code,
        account_name: (b.account_name || "(Sin Nombre").trim(),
        initial_balance: absValue,
        type,
        userIdSafe,          // ✅ REQUIRED FOR RULES
        entityId,        // ✅ GOOD PRACTICE
        updateAt: now,
        createdAt: now,
      },
      { merge: true }
    );
  });

  await batch.commit();
}

/**
 * Obtiene los balances iniciales guardados de una entidad.
 * @param entityId - ID de la entidad
 * @returns Un mapa de balances: { [account_code]: initial_balance }
 */
export async function fetchInitialBalances(
  entityId: string
): Promise<Record<string, InitialBalance>> {
  const snapshot = await getDocs(
    collection(db, "entities", entityId, "initialBalances")
);

  const result: Record<string, InitialBalance> = {};

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data.account_code) return;

    result[data.account_code] = {
        account_code: data.account_code,
        account_name: data.account_name || "",
        initial_balance: Number(data.initial_balance) || 0,
        type: data.type === "credit" ? "credit" : "debit",
    };
  });

  return result;
}