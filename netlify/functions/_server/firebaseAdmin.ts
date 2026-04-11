// =======================================================
// netlify/functions/_server/firebaseAdmin.ts
// CONTILISTO — FIREBASE ADMIN INITIALIZATION (FINAL SAFE)
// =======================================================

import * as admin from "firebase-admin";

// ✅ LOAD FROM LOCAL FILE (PRIMARY METHOD)
import serviceAccount from "../firebase-admin.json";

// =======================================================
// VALIDATE SERVICE ACCOUNT
// =======================================================

function validateServiceAccount(json: any) {
  if (
    !json.project_id ||
    !json.client_email ||
    !json.private_key
  ) {
    throw new Error("Invalid Firebase service account JSON");
  }

  return json;
}

// =======================================================
// INITIALIZE ADMIN SDK (SAFE SINGLETON)
// =======================================================

let adminInstance: admin.app.App | undefined;

export function getAdmin(): admin.app.App {
  if (adminInstance) return adminInstance;

  if (!admin.apps.length) {
    const credentials = validateServiceAccount(serviceAccount);

    adminInstance = admin.initializeApp({
      credential: admin.credential.cert(credentials),

      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET ||
        process.env.VITE_FIREBASE_STORAGE_BUCKET,
    });

    adminInstance.firestore().settings({
      ignoreUndefinedProperties: true,
    });

  } else {
    const existingApp = admin.apps[0];

    if (!existingApp) {
      throw new Error("Firebase admin app not initialized");
    }

    adminInstance = existingApp;
  }

  return adminInstance;
}

// =======================================================
// EXPORT SINGLETONS
// =======================================================

export const adminApp = getAdmin();
export const adminDb = adminApp.firestore();
export const adminStorage = adminApp.storage();

export { admin };
export default adminApp;