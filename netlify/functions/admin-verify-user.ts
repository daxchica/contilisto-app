// netlify/functions/admin-verify-user.ts
// Marks a Firebase Auth user's email as verified.
// Used to unblock admin-created users who were created before emailVerified: true was set.
// Caller must be authenticated as owner or master.

import { admin, adminDb, firebaseInitError } from "./_server/firebaseAdmin";

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  if (firebaseInitError) {
    return Response.json({ ok: false, error: `Firebase init failed: ${firebaseInitError}` }, { status: 500 });
  }

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let callerUid: string;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    callerUid = decoded.uid;
  } catch (e: any) {
    return Response.json({ ok: false, error: `Token error: ${e?.message ?? e}` }, { status: 401 });
  }

  const callerDoc = await adminDb.collection("users").doc(callerUid).get();
  const callerRole = callerDoc.data()?.role;
  if (callerRole !== "owner" && callerRole !== "master") {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { uid } = await req.json();
  if (!uid) return Response.json({ ok: false, error: "uid is required" }, { status: 400 });

  try {
    await admin.auth().updateUser(uid, { emailVerified: true });
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message ?? "Error verifying user" }, { status: 400 });
  }
};
