import admin from "firebase-admin";

let _initError: string | null = null;

try {
  if (!admin.apps.length) {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64 ?? "";
    if (!b64) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 env var is not set");
    const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }
} catch (err: any) {
  _initError = err.message ?? "Unknown Firebase init error";
  console.error("🔥 Firebase Admin init failed:", _initError);
}

// Proxy so handlers get a meaningful error (not a 502) when init failed
const adminDb = admin.apps.length
  ? admin.firestore()
  : (new Proxy({} as FirebaseFirestore.Firestore, {
      get() { throw new Error(`Firebase not initialized: ${_initError}`); },
    }));

function getAdminBucket() {
  if (!admin.apps.length) throw new Error(`Firebase not initialized: ${_initError}`);
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET || "contalisto-9a645.appspot.com";
  return admin.storage().bucket(bucketName);
}

export { admin, adminDb, getAdminBucket };
export default adminDb;
