// src/services/bankMovementService.ts
import { db, auth } from "../firebase-config";
import {
  collection,
  addDoc,
  Timestamp,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import type { BankMovement } from "../types/bankTypes";

/* ------------------------------------------------------
 * ADD BANK MOVEMENT
 * ------------------------------------------------------ */
export async function addBankMovement(
  entityId: string,
  movement: Omit<BankMovement, "id" | "createdAt" | "createdBy">
): Promise<string> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Usuario no autenticado");
    if (!entityId) throw new Error("entityId es requerido");

    const colRef = collection(db, "entities", entityId, "bank_movements");

    const payload = {
      ...movement,
      entityId,
      createdBy: currentUser.uid,
      createdAt: Timestamp.now(),
      date: movement.date,
      amount: movement.amount,
      type: movement.type, // "INGRESO" | "EGRESO"
      status: movement.status ?? "recorded",
    };

    const ref = await addDoc(colRef, payload);
    return ref.id;
  } catch (err) {
    console.error("❌ Error al agregar movimiento:", err);
    throw err;
  }
}

/* ------------------------------------------------------
 * FETCH BANK MOVEMENTS
 * ------------------------------------------------------ */
export async function fetchBankMovements(
  entityId: string
): Promise<BankMovement[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuario no autenticado");
  if (!entityId) throw new Error("entityId es requerido");

  const colRef = collection(db, "entities", entityId, "bank_movements");
  const q = query(colRef, where("createdBy", "==", currentUser.uid));

  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data();

    return {
      id: d.id,
      entityId,
      bankAccountId: data.bankAccountId ?? undefined,
      date: data.date,
      description: data.description ?? "",
      amount: data.amount ?? 0,
      type: data.type ?? "INGRESO",
      status: data.status ?? "recorded",
      createdBy: data.createdBy ?? "",
      createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
    } as BankMovement;
  });
}