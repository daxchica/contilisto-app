import admin from "firebase-admin";
import serviceAccount from "../firebase-admin.json";

if (!admin.apps.length) {
  const sa = serviceAccount as admin.ServiceAccount & { project_id?: string };
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: sa.projectId ?? sa.project_id,
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