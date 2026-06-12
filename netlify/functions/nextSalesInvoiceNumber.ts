import { adminDb } from "./_server/firebaseAdmin";

export default async (req: Request): Promise<Response> => {
  try {
    const { entityId } = await req.json();
    if (!entityId) return new Response("entityId required", { status: 400 });

    const ref = adminDb.doc(`entities/${entityId}/counters/salesInvoice`);

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);

      if (!snap.exists) {
        tx.set(ref, { establishment: "001", emissionPoint: "001", lastSequential: 0 });
        return { establishment: "001", emissionPoint: "001", sequential: 1 };
      }

      const data = snap.data() as any;
      const establishment = data.establishment || "001";
      const emissionPoint = data.emissionPoint || "001";
      const next = Number(data.lastSequential || 0) + 1;

      tx.update(ref, { lastSequential: next });
      return { establishment, emissionPoint, sequential: next };
    });

    const sequentialStr = String(result.sequential).padStart(9, "0");
    const invoiceNumber = `${result.establishment}-${result.emissionPoint}-${sequentialStr}`;

    return Response.json({ ...result, invoiceNumber });
  } catch (err: any) {
    return new Response(err?.message || "Server error", { status: 500 });
  }
};
