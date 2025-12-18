// src/services/adminUserService.ts
import { db } from "@/firebase-config";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import type { UserRole } from "@/context/AuthContext";

export interface AdminUser {
  uid: string;
  email: string;
  role: UserRole;
  planKey?: string;
  planStatus?: string;
  isTestAccount?: boolean;
}

function normalizeRole(value: any): UserRole {
  return value === "master" || value === "admin" || value === "user"
    ? value
    : "user";
}

export async function fetchUsers(): Promise<AdminUser[]> {
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
    await updateDoc(doc(db, "users", uid), { role });
    }

    export async function updateUserStatus(
    uid: string,
    status: "active" | "inactive"
    ) {
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
    await updateDoc(doc(db, "users", uid), data);
    }