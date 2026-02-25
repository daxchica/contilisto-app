// =======================================================
// netlify/functions/_server/firebaseAdmin.ts
// CONTILISTO — FIREBASE ADMIN INITIALIZATION (PRODUCTION SAFE)
// =======================================================

import * as admin from "firebase-admin";


// =======================================================
// LOAD SERVICE ACCOUNT FROM ENV (BASE64 SAFE)
// =======================================================

function loadServiceAccount()
{
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;

  if (!b64)
    throw new Error(
      "Missing FIREBASE_SERVICE_ACCOUNT_B64 environment variable"
    );

  const json = JSON.parse(
      Buffer
        .from(b64.trim(), "base64")
        .toString("utf-8")
    );

  if (
    !json.project_id ||
    !json.client_email ||
    !json.private_key
  )
  {
    throw new Error(
      "Invalid Firebase service account JSON"
    );
  }

  return json;
}

// =======================================================
// INITIALIZE ADMIN SDK (SAFE SINGLETON)
// =======================================================

let adminInstance: admin.app.App | undefined;

export function getAdmin(): admin.app.App
{
  if (adminInstance)
    return adminInstance;

  if (!admin.apps.length)
  {
    adminInstance =
      admin.initializeApp({

        credential:
          admin.credential.cert(
            loadServiceAccount()
          ),

        storageBucket:
          process.env.FIREBASE_STORAGE_BUCKET ||
          process.env.VITE_FIREBASE_STORAGE_BUCKET,

      });

    adminInstance.firestore().settings({
      ignoreUndefinedProperties: true,
    });

  }
  else
  {
    adminInstance = admin.apps[0] as admin.app.App;
  }

  return adminInstance!;
}


// =======================================================
// EXPORT SINGLETONS (STANDARDIZED NAMES)
// =======================================================

export const adminApp = getAdmin();
export const adminDb = adminApp.firestore();
export const adminStorage = adminApp.storage();
export { admin }
export default adminApp;
