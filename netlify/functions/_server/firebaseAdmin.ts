import admin from "firebase-admin";

if (!admin.apps.length) {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64 ?? "";
  const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const adminDb = admin.firestore();

function getAdminBucket() {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET || "contalisto-9a645.appspot.com";
  return admin.storage().bucket(bucketName);
}

export { admin, adminDb, getAdminBucket };
export default adminDb;
