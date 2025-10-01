import { getAuth } from "firebase/auth";

export function uidOrThrow(): string {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error("Usuario no autenticado");
  return uid;
}