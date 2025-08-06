// src/services/entityService.ts

import { 
  collection, 
  where, 
  getDocs,
  addDoc,
  query,
  getFirestore,
  doc,
  deleteDoc
} from "firebase/firestore";
import { auth, db } from "../firebase-config";
import { User } from "firebase/auth";

// Creating entity using RUC as ID
export const createEntity = async (
  user: User, 
  ruc: string,
  name: string
) => {
  const ref = collection(db, "entities"); 
  const docRef = await addDoc(ref, {
    ruc,
    name,
    uid: user.uid,
    createdAt: new Date().toISOString(),
  });
  console.log("Entity created with ID:", docRef.id);
  return docRef.id;
};

// Obtain user's entities
export const fetchEntities = async (user: User) => {
  if (!user?.uid) {
    console.error("No user provided to fetchEntities");
    return [];
  }

  console.log(" Fetching entities for UID:", user.uid);
  try {
    const q = query(collection(db, "entities"), where("uid", "==", auth.currentUser?.uid));
    const snapshot = await getDocs(q);
    console.log("Fetched", snapshot.size, "entities");

    return snapshot.docs.map(doc => ({ 
      id: doc.id,
      ruc: doc.data().ruc, 
      name: doc.data().name, 
    }));
  } catch (error) {
    console.error("Firestore fetch error:", error);
    return [];
  }
};

export const getEntities = async (uid: string) => {
  const q = query(collection(db, "entities"), where("uid", "==", uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ruc: doc.data().ruc,
    name: doc.data().name,
  }));
};

export async function deleteEntity(entityId: string): Promise<void> {
  const db = getFirestore();
  const entityRef = doc(db, "entities", entityId);
  await deleteDoc(entityRef);
}