// src/services/entityService.ts

import { 
  collection, 
  where, 
  getDocs,
  addDoc,
  query
} from "firebase/firestore";
import { db } from "../firebase-config";
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
    uid: user.uid
  });
  console.log("Entity created with ID:", docRef.id);
  return docRef.id;
};

// Obtain user's entities
export const fetchEntities = async (user: User) => {
  if (!user || !user.uid) {
    console.error("No user provided to fetchEntities");
    return [];
  }

  console.log(" Fetching entities for UID:", user.uid);
  try {
    const q = query(collection(db, "entities"), where("uid", "==", user.uid));
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
