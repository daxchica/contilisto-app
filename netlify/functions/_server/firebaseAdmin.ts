// =======================================================
// netlify/functions/_server/firebaseAdmin.ts
// CONTILISTO — FIREBASE ADMIN INITIALIZATION (PRODUCTION SAFE)
// =======================================================

import * as admin from "firebase-admin";

// =======================================================
// LOAD SERVICE ACCOUNT FROM ENV (BASE64)
// =======================================================

function loadServiceAccount() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;

  if (!b64) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_B64");
  }

  const json = JSON.parse(
    Buffer.from(b64.trim(), "base64").toString("utf-8")
  );

  return validateServiceAccount(json);
}

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
    const credentials = loadServiceAccount(); // ✅ FIXED

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