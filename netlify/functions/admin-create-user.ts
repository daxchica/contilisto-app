// netlify/functions/admin-create-user.ts
// Creates a Firebase Auth user + Firestore document.
// Caller must be authenticated as owner or master.

import type { Handler } from "@netlify/functions";
import { admin, adminDb } from "./_server/firebaseAdmin";

function json(status: number, body: object) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  try {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  // Verify caller identity
  const token = event.headers["authorization"]?.replace("Bearer ", "");
  if (!token) return json(401, { ok: false, error: "Unauthorized" });

  let callerUid: string;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    callerUid = decoded.uid;
  } catch {
    return json(401, { ok: false, error: "Invalid token" });
  }

  // Verify caller is owner or master
  const callerDoc = await adminDb.collection("users").doc(callerUid).get();
  const callerRole = callerDoc.data()?.role;
  if (callerRole !== "owner" && callerRole !== "master") {
    return json(403, { ok: false, error: "Forbidden" });
  }

  const { email, password, role, planKey } = JSON.parse(event.body || "{}");

  if (!email || !password) {
    return json(400, { ok: false, error: "email and password are required" });
  }

  // Create Firebase Auth user
  let newUser: admin.auth.UserRecord;
  try {
    newUser = await admin.auth().createUser({ email, password });
  } catch (err: any) {
    return json(400, { ok: false, error: err.message ?? "Error creating user" });
  }

  // Create Firestore document
  await adminDb.collection("users").doc(newUser.uid).set({
    uid: newUser.uid,
    email,
    displayName: "",
    role: role ?? "user",
    planKey: planKey ?? "estudiante",
    planStatus: "active",
    subscriptionStatus: "active",
    subscription: "Free",
    isTestAccount: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return json(200, { ok: true, uid: newUser.uid });
  } catch (err: any) {
    return json(500, { ok: false, error: err.message ?? "Error interno del servidor" });
  }
};
