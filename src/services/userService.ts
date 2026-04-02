// src/services/userService.ts

import { db } from "@/firebase-config";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

/* ============================================================
 * TYPES
 * ============================================================ */

export type UserRole = "owner" | "accountant" | "assistant" | "viewer";

export type SubscriptionPlan = "Free" | "Pro";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;

  role: UserRole;

  subscription: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;

  stripeCustomerId?: string | null;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  plan?: "estudiante" | "contador" | "corporativo";
}

/* ============================================================
 * DEFAULT USER FACTORY
 * ============================================================ */

function buildDefaultUser(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}): AppUser {
  return {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    photoURL: user.photoURL ?? "",

    role: "owner",

    subscription: "Free",
    subscriptionStatus: "active",

    stripeCustomerId: null,
  };
}

/* ============================================================
 * ENSURE USER EXISTS
 * ============================================================ */

export async function ensureUserDocument(firebaseUser: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}) {
  const ref = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const newUser = buildDefaultUser(firebaseUser);

    await setDoc(ref, {
      ...newUser,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

/* ============================================================
 * GET USER (SAFE NORMALIZATION)
 * ============================================================ */

export async function getUser(uid: string): Promise<AppUser | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data();

  return {
    uid,
    email: data.email ?? "",
    displayName: data.displayName ?? "",
    photoURL: data.photoURL ?? "",

    role: data.role ?? "owner",

    subscription: data.subscription ?? "Free",
    subscriptionStatus: data.subscriptionStatus ?? "active",

    stripeCustomerId: data.stripeCustomerId ?? null,

    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/* ============================================================
 * UPDATE PROFILE (SAFE FIELDS ONLY)
 * ============================================================ */

export async function updateUserProfile(
  uid: string,
  data: {
    displayName?: string;
    photoURL?: string;
  }
) {
  const ref = doc(db, "users", uid);

  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/* ============================================================
 * ADMIN-LEVEL UPDATE (ROLE / SUBSCRIPTION)
 * Only for future protected admin logic
 * ============================================================ */

export async function updateUserAccess(
  uid: string,
  data: Partial<Pick<AppUser, "role" | "subscription" | "subscriptionStatus">>
) {
  const ref = doc(db, "users", uid);

  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}