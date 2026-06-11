import admin from "firebase-admin";

if (!admin.apps.length) {
  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID   ?? "contalisto-9a645";
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? "";
  const privateKey  = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const adminDb = admin.firestore();

/**
 * Lazy accessor for Firebase Storage bucket.
 * Called only by functions that actually need Storage (e.g. loadP12FromStorage).
 * Avoids crashing at module-load time when FIREBASE_STORAGE_BUCKET is not set.
 */
function getAdminBucket() {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET || "contalisto-9a645.appspot.com";
  return admin.storage().bucket(bucketName);
}

export { admin, adminDb, getAdminBucket };
export default adminDb;