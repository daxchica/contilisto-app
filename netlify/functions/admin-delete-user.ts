// netlify/functions/admin-delete-user.ts
// Deletes a Firebase Auth user + Firestore document.
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

  const { uid } = JSON.parse(event.body || "{}");

  if (!uid) return json(400, { ok: false, error: "uid is required" });

  // Prevent self-deletion
  if (uid === callerUid) {
    return json(400, { ok: false, error: "No puedes eliminar tu propia cuenta" });
  }

  // Delete Firebase Auth user
  try {
    await admin.auth().deleteUser(uid);
  } catch (err: any) {
    // If user doesn't exist in Auth, continue to delete Firestore doc anyway
    if (err.code !== "auth/user-not-found") {
      return json(400, { ok: false, error: err.message ?? "Error deleting user" });
    }
  }

  // Delete Firestore document
  await adminDb.collection("users").doc(uid).delete();

  return json(200, { ok: true });
};
