// src/services/initialBalanceService.ts

import { getFirestore, doc, setDoc, getDocs, collection } from "firebase/firestore";

const db = getFirestore();

type InitialBalance = {
    account_code: string;
    account_name: string;
    initial_balance: number;
    type?: "debit" | "credit";
};

/**
 * Guarda los balances iniciales por cuenta para una entidad.
 * @param entityId - ID de la entidad
 * @param balances - Arreglo de balances iniciales: [{ account_code, account_name, initial_balance }]
 */
export async function saveInitialBalances(
  entityId: string,
  balances: InitialBalance[]
): Promise<void> {
  const batchPromises = balances.map((b) => {
    const code = b.account_code.trim();
    const name = (b.account_name || "").trim() || "(Sin Nombre)";
    const raw = Number(b.initial_balance || 0);
    const absValue = Math.abs(raw);

    if (!code || isNaN(absValue) || absValue === 0) return;

    const type: "debit" | "credit" = raw >= 0 ? "debit" : "credit";

    const ref = doc(db, "entities", entityId, "initialBalances", code);
    return setDoc(
        ref, 
        { 
            account_code: code,
            account_name: name,
            initial_balance: absValue,
            type, 
        },
        { merge: true }
    );
  });

  await Promise.all(batchPromises.filter(Boolean));
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
    if (data.account_code) return;

        const raw = Number(data.initial_balance || 0);
        const abs = Math.abs(raw);
        const type: "debit" | "credit" = raw >= 0 ? "debit" : "credit";

        result[data.account_code] = {
            account_code: data.account_code,
            account_name: data.account_name || "",
            initial_balance: abs,
            type: data.type || type,
        };
    });

  return result;
}