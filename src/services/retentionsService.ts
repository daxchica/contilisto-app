import { db } from "@/firebase-config";
import { collection, addDoc } from "firebase/firestore";

export async function saveRetention(
  entityId: string,
  data: any
) {
  const ref = collection(db, "entities", entityId, "retentions");
  await addDoc(ref, data);
}