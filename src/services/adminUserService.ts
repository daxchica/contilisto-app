// src/services/adminUserService.ts
import { db } from "@/firebase-config";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { UserRole } from "@/context/AuthContext";
import { requireNonEmpty } from "./requireNonEmpty";

async function getIdToken(): Promise<string> {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error("No autenticado");
  return token;
}

export interface AdminUser {
  uid: string;
  email: string;
  role: UserRole;
  planKey?: string;
  planStatus?: string;
  isTestAccount?: boolean;
}

function normalizeRole(value: any): UserRole {
  const valid: UserRole[] = ["owner", "master", "admin", "accountant", "assistant", "user", "viewer"];
  return valid.includes(value) ? value : "viewer";
}

export async function fetchUsers(): Promise<AdminUser[]> {
  const uid = getAuth().currentUser?.uid;
  if (!uid) {
    throw new Error("admin requerido");
  }
  const snap = await getDocs(collection(db, "users"));
  
  return snap.docs.map((d) => {
    const data = d.data();
    return { 
        uid: d.id, 
        email: data.email,
        role: normalizeRole(data.role),
        planKey: data.planKey,
        planStatus: data.planStatus,
        isTestAccount: data.isTestAccount,
        };
    });
    }

    export async function updateUserRole(
    uid: string,
    role: UserRole
    ) {
    requireNonEmpty(uid, "uid");
    await updateDoc(doc(db, "users", uid), { role });
    }

    export async function updateUserStatus(
    uid: string,
    status: "active" | "inactive"
    ) {
    requireNonEmpty(uid, "uid");
    await updateDoc(doc(db, "users", uid), {
        planStatus: status,
    });
    }

    export async function updateUser(
    uid: string,
    data: Partial<Pick<
        AdminUser,
        "role" | "planKey" | "planStatus" | "isTestAccount"
    >>
    ) {
    requireNonEmpty(uid, "uid");
    await updateDoc(doc(db, "users", uid), data);
    }

export async function createAdminUser(payload: {
  email: string;
  password: string;
  role: UserRole;
  planKey: string;
}): Promise<string> {
  const token = await getIdToken();
  const res = await fetch("/.netlify/functions/admin-create-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text || "Error en el servidor");
  }
  if (!data.ok) throw new Error(data.error ?? "Error creando usuario");
  return data.uid;
}

export async function verifyAdminUser(uid: string): Promise<void> {
  requireNonEmpty(uid, "uid");
  const token = await getIdToken();
  const res = await fetch("/.netlify/functions/admin-verify-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ uid }),
  });
  const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  if (!data.ok) throw new Error(data.error ?? "Error verificando usuario");
}

export async function deleteAdminUser(uid: string): Promise<void> {
  requireNonEmpty(uid, "uid");
  const token = await getIdToken();
  const res = await fetch("/.netlify/functions/admin-delete-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ uid }),
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Error al eliminar usuario (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!data.ok) throw new Error(data.error ?? "Error al eliminar usuario");
}
