// services/bankMovementService.ts
import { db, auth } from "../firebase-config";
import { collection, addDoc, Timestamp, getDocs, query, where } from "firebase/firestore";

export interface BankMovement {
  date: string; // ISO date string
  description: string;
  amount: number;
  type: "ingreso" | "egreso";
  reference?: string;
  reconciled: boolean;
}

export async function addBankMovement(entityId: string, movement: BankMovement) {
    const currentUser = auth.currentUser;

    if (!currentUser) {
        throw new Error("Usuario no autenticado");
    }

    if (!entityId) {
        throw new Error("entityId es requerido");
    }

    const colRef = collection(db, "entities", entityId, "bank_movements");

    const docData = {
        ...movement,
        uid: currentUser.uid,
        timestamp: Timestamp.fromDate(new Date(movement.date)),
        createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(colRef, docData);
    console.log("Movimiento bancario agregado con ID:", docRef.id);
    return docRef.id;
}

export async function fetchBankMovements(entityId: string): Promise<(BankMovement & { id: string })[]> {
    const currentUser = auth.currentUser;

    if (!currentUser) {
        throw new Error("Usuario no autenticado");
    }

    if (!entityId) {
        throw new Error("entityId es requerido");
    }
    const colRef = collection(db, "entities", entityId, "bank_movements");

  const q = query(colRef, where("uid", "==", currentUser.uid));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      date: (data.timestamp?.toDate?.() ?? new Date()).toISOString().split("T")[0],
      description: data.description,
      amount: data.amount,
      type: data.type,
      reference: data.reference || "",
      reconciled: data.reconciled ?? false,
    };
  });
}