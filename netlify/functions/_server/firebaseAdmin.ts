import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const adminDb = admin.firestore();
const adminBucket = admin.storage().bucket();

export { admin, adminDb, adminBucket };
export default adminDb;