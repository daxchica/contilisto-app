// netlify/functions/admin-create-user.ts
// Creates a Firebase Auth user + Firestore document.
// Caller must be authenticated as owner or master.

import { admin, adminDb } from "./_server/firebaseAdmin";

export default async (req: Request): Promise<Response> => {
  try {
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

    const { email, password, role, planKey } = await req.json();

    if (!email || !password) {
      return Response.json({ ok: false, error: "email and password are required" }, { status: 400 });
    }

    // Create Firebase Auth user
    let newUser: admin.auth.UserRecord;
    try {
      newUser = await admin.auth().createUser({ email, password });
    } catch (err: any) {
      return Response.json({ ok: false, error: err.message ?? "Error creating user" }, { status: 400 });
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

    return Response.json({ ok: true, uid: newUser.uid });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message ?? "Error interno del servidor" }, { status: 500 });
  }
};
