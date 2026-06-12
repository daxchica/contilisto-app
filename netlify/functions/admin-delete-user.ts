// netlify/functions/admin-delete-user.ts
// Deletes a Firebase Auth user + Firestore document.
// Caller must be authenticated as owner or master.

import { admin, adminDb } from "./_server/firebaseAdmin";

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  // Verify caller identity
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let callerUid: string;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    callerUid = decoded.uid;
  } catch {
    return Response.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  // Verify caller is owner or master
  const callerDoc = await adminDb.collection("users").doc(callerUid).get();
  const callerRole = callerDoc.data()?.role;
  if (callerRole !== "owner" && callerRole !== "master") {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { uid } = await req.json();

  if (!uid) return Response.json({ ok: false, error: "uid is required" }, { status: 400 });

  // Prevent self-deletion
  if (uid === callerUid) {
    return Response.json({ ok: false, error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
  }

  // Delete Firebase Auth user
  try {
    await admin.auth().deleteUser(uid);
  } catch (err: any) {
    if (err.code !== "auth/user-not-found") {
      return Response.json({ ok: false, error: err.message ?? "Error deleting user" }, { status: 400 });
    }
  }

  // Delete Firestore document
  await adminDb.collection("users").doc(uid).delete();

  return Response.json({ ok: true });
};
