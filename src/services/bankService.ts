// services/bankService.ts
import { db } from "../firebase-config";
import { collection, getDocs, query, where } from "firebase/firestore";

export async function fetchBankMovements(entityId: string) {
  const q = query(collection(db, "bankMovements"), where("entityId", "==", entityId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}