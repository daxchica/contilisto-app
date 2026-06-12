// netlify/functions/send-invoice-to-sri.ts
import { admin, adminDb } from "./_server/firebaseAdmin";
import { sendToSri } from "./sri/sendToSri";

export default async (req: Request): Promise<Response> => {
  try {
    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    const { entityId, invoiceId } = await req.json();

    if (!entityId || !invoiceId) {
      return Response.json({ ok: false, error: "entityId and invoiceId required" }, { status: 400 });
    }

    const invoiceRef = adminDb
      .collection("entities")
      .doc(entityId)
      .collection("invoices")
      .doc(invoiceId);

    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) {
      return Response.json({ ok: false, error: "Invoice not found" }, { status: 404 });
    }

    const invoice = invoiceSnap.data()!;

    if (invoice.status !== "signed") {
      return Response.json({ ok: false, error: `Invoice must be SIGNED. Current: ${invoice.status}` }, { status: 400 });
    }

    if (!invoice.xmlSigned) {
      return Response.json({ ok: false, error: "xmlSigned not found. Sign invoice first." }, { status: 400 });
    }

    if (!invoice.sri?.claveAcceso) {
      return Response.json({ ok: false, error: "claveAcceso missing on invoice.sri" }, { status: 400 });
    }

    const environment = invoice.sri.ambiente ?? "1";

    const sriResponse = await sendToSri({
      environment,
      signedXml: invoice.xmlSigned,
      accessKey: invoice.sri.claveAcceso,
    });

    const estadoRecepcion =
      "recepcionOk" in sriResponse && sriResponse.recepcionOk === true
        ? "RECIBIDA"
        : "DEVUELTA";

    await invoiceRef.update({
      status: "sent-sri",
      "sri.recepcion": { ok: estadoRecepcion === "RECIBIDA", raw: sriResponse.raw },
      "sri.estadoRecepcion": estadoRecepcion,
      "sri.sentAt": admin.firestore.FieldValue.serverTimestamp(),
    });

    return Response.json({
      ok: true,
      claveAcceso: invoice.sri.claveAcceso,
      estadoRecepcion,
    });
  } catch (err: any) {
    console.error("SEND-SRI ERROR:", err);
    return Response.json({ ok: false, error: err?.message ?? "Internal error sending to SRI" }, { status: 500 });
  }
};
