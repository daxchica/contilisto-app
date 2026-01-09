// netlify/functions/_lib/firebaseAdmin.ts
import firebaseAdmin from "firebase-admin";
import { Settings } from "lucide-react";

function loadServiceAccount() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;

  if (!b64) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_B64 environment variable");
  }

  const json = JSON.parse(
    Buffer.from(b64.trim(), "base64").toString("utf-8")
  );

  // Minimal validation (prevents silent Firebase crashes)
  if (!json.project_id || !json.client_email || !json.private_key) {
    throw new Error("Invalid Firebase service account JSON");
  }

  return json;
}

function initAdmin() {
// Initialize Admin SDK ONCE
  if (!firebaseAdmin.apps.length) {
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(loadServiceAccount()),
      storageBucket: 
        process.env.FIREBASE_STORAGE_BUCKET || 
        process.env.VITE_FIREBASE_STORAGE_BUCKET, // ✅ IMPORTANT
    });
    
    firebaseAdmin.firestore().settings({
      ignoreUndefinedProperties: true,
    });
  }

  return firebaseAdmin;
}

/* =========================
   EXPORTED SINGLETONS
========================== */
export const admin = initAdmin();
export const adminDb = admin.firestore();
export const adminStorage = admin.storage();