import type { Handler } from "@netlify/functions";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

export const handler: Handler = async (event) => {
  try {
    const { entityId } = JSON.parse(event.body || "{}");
    if (!entityId) return { statusCode: 400, body: "entityId required" };

    const db = admin.firestore();
    const ref = db.doc(`entities/${entityId}/counters/salesInvoice`);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);

      // If missing, initialize safely
      if (!snap.exists) {
        tx.set(ref, {
          establishment: "001",
          emissionPoint: "001",
          lastSequential: 0,
        });
        return { establishment: "001", emissionPoint: "001", sequential: 1 };
      }

      const data = snap.data() as any;
      const establishment = data.establishment || "001";
      const emissionPoint = data.emissionPoint || "001";
      const lastSequential = Number(data.lastSequential || 0);

      const next = lastSequential + 1;

      tx.update(ref, { lastSequential: next });

      return { establishment, emissionPoint, sequential: next };
    });

    // Format SRI invoice number: 001-001-000000125
    const sequentialStr = String(result.sequential).padStart(9, "0");
    const invoiceNumber = `${result.establishment}-${result.emissionPoint}-${sequentialStr}`;

    return {
      statusCode: 200,
      body: JSON.stringify({ ...result, invoiceNumber }),
      headers: { "Content-Type": "application/json" },
    };
  } catch (err: any) {
    return { statusCode: 500, body: err?.message || "Server error" };
  }
};