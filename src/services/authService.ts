// src/services/authService.ts
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  User
} from "firebase/auth";
import { auth, db } from "../firebase-config";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export async function registerUser(payload: {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  company: string;
  planKey: string;
}): Promise<User> {
  const cred = await createUserWithEmailAndPassword(
    auth,
    payload.email,
    payload.password
  );

  const user = cred.user;

  // Send email verification
  await sendEmailVerification(user);

  // Create Firestore profile
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    company: payload.company,

    planKey: payload.planKey,
    planStatus: payload.planKey === "starter" ? "free" : "pending_payment",

    emailVerified: false,
    phoneVerified: false,
    verificationStatus: "pending",

    createdAt: serverTimestamp(),
  });

  return user;
}