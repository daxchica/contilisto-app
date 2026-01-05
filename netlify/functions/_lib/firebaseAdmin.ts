// netlify/functions/_lib/firebaseAdmin.ts
import firebaseAdmin from "firebase-admin";

function loadServiceAccount() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;

  if (!b64) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_B64 environment variable");
  }

  let json: any;

  try {
    const decoded = Buffer
      .from(b64.trim(), "base64")
      .toString("utf-8");

    json = JSON.parse(decoded);
  } catch (err) {
    throw new Error(
      "Invalid FIREBASE_SERVICE_ACCOUNT_B64 (base64 decode or JSON parse failed)"
    );
  }

  // Minimal validation (prevents silent Firebase crashes)
  if (
    !json.project_id ||
    !json.client_email ||
    !json.private_key
  ) {
    throw new Error(
      "Service account JSON missing required fields"
    );
  }

  return json;
}

// Initialize Admin SDK ONCE
if (!firebaseAdmin.apps.length) {
  firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(loadServiceAccount()),
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET, // ✅ IMPORTANT
  });
}

// Firestore
export const adminDb = firebaseAdmin.firestore();

// Storage
export const adminStorage = firebaseAdmin.storage();

// Default export if needed
export const admin = firebaseAdmin;
