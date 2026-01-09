// netlify/functions/send-invoice-to-sri.ts
import type { Handler } from "@netlify/functions";
import { admin, adminDb } from "./_server/firebaseAdmin";
import { sendToSri } from "./sri/sendToSri";

export const handler: Handler = async (event) => {
  try {
    /* ===============================
       METHOD
    ================================ */
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    /* ===============================
       INPUT
    ================================ */
    const { entityId, invoiceId } = JSON.parse(event.body || "{}");
    
    if (!entityId || !invoiceId) {
      return json(400, { ok: false, error: "entityId and invoiceId required" });
    }

    /* ===============================
       LOAD INVOICE
    ================================ */
    const invoiceRef = adminDb
      .collection("entities")
      .doc(entityId)
      .collection("invoices")
      .doc(invoiceId);

    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) {
      return json(404, { ok: false, error: "Invoice not found" });
    }

    const invoice = invoiceSnap.data()!;

    /* ===============================
       VALIDATIONS
    ================================ */
    if (invoice.status !== "signed") {
      return json(400, {
        ok: false,
        error: `Invoice must be SIGNED. Current: ${invoice.status}`,
      });
    }

    if (!invoice.xmlSigned) {
      return json(400, {
        ok: false,
        error: "xmlSigned not found. Sign invoice first.",
      });
    }

    if (!invoice.sri?.claveAcceso) {
      return json(400, {
        ok: false,
        error: "claveAcceso missing on invoice.sri",
      });
    }

    const environment = invoice.sri.ambiente ?? "1";

    /* ===============================
       SEND TO SRI (RECEPCIÓN)
    ================================ */
    const sriResponse = await sendToSri({
      environment,
      signedXml: invoice.xmlSigned,
      accessKey: invoice.sri.claveAcceso,
    });

    const estadoRecepcion =
      "recepcionOk" in sriResponse && sriResponse.recepcionOk === true
        ? "RECIBIDA"
        : "DEVUELTA";

    /* ===============================
       SAVE RESULT
    ================================ */
    await invoiceRef.update({
      status: "sent-sri",
      "sri.recepcion": {
        ok: estadoRecepcion === "RECIBIDA",
        raw: sriResponse.raw,
      },
      "sri.estadoRecepcion": estadoRecepcion,
      "sri.sentAt": admin.firestore.FieldValue.serverTimestamp(),
    });

    /* ===============================
       RESPONSE
    ================================ */
    return json(200, {
      ok: true,
      claveAcceso: invoice.sri.claveAcceso,
      estadoRecepcion,
    });
  } catch (err: any) {
    console.error("SEND-SRI ERROR:", err);
    
    return json(500, {
      ok: false,
      error: err?.message ?? "Internal error sending to SRI",
    });
  }
};

/* ===============================
   JSON helper (IMPORTANT)
================================ */
function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}