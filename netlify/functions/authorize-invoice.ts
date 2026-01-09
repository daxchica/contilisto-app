// netlify/functions/authorize-invoice.ts
import type { Handler } from "@netlify/functions";
import { admin, adminDb } from "./_server/firebaseAdmin";
import { authorizeFromSri } from "./sri/authorizeFromSri";

/* ======================================================
   AUTHORIZE INVOICE — SRI AUTORIZACIÓN
====================================================== */
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
      return json(400, {
        ok: false,
        error: "entityId and invoiceId are required",
      });
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
    if (invoice.status !== "sent-sri") {
      return json(400, {
        ok: false,
        error: `Invoice must be SENT-SRI. Current: ${invoice.status}`,
      });
    }

    if (!invoice.sri?.claveAcceso) {
      return json(400, {
        ok: false,
        error: "claveAcceso missing on invoice.sri",
      });
    }

    if (!invoice.sri?.estadoRecepcion) {
      return json(400, {
        ok: false,
        error: "estadoRecepcion missing on invoice.sri",
      });
    }

    if (invoice.sri.estadoRecepcion !== "RECIBIDA") {
      return json(400, {
        ok: false,
        error: `Cannot authorize invoice with estadoRecepcion=${invoice.sri.estadoRecepcion}`,
      });
    }

    const environment = invoice.sri.ambiente ?? "1";

    /* ===============================
       AUTHORIZE FROM SRI
    ================================ */
    const authResponse = await authorizeFromSri({
      environment,
      accessKey: invoice.sri.claveAcceso,
    });

    const autorizado =
      authResponse.autorizacion?.estado === "AUTORIZADO";

    /* ===============================
       PERSIST RESULT
    ================================ */
    await invoiceRef.update({
      status: autorizado ? "authorized" : "rejected",
      "sri.autorizacion": {
        estado: authResponse.autorizacion?.estado ?? "NO AUTORIZADO",
        numeroAutorizacion:
          authResponse.autorizacion?.numeroAutorizacion ?? null,
        fechaAutorizacion:
          authResponse.autorizacion?.fechaAutorizacion ?? null,
        xmlAutorizado:
          authResponse.autorizacion?.comprobante ?? null,
        mensajes: authResponse.autorizacion?.mensajes ?? [],
        raw: authResponse.raw,
      },
      "sri.authorizedAt": admin.firestore.FieldValue.serverTimestamp(),
    });

    /* ===============================
       RESPONSE
    ================================ */
    return json(200, {
      ok: true,
      claveAcceso: invoice.sri.claveAcceso,
      estado: autorizado ? "AUTORIZADO" : "NO AUTORIZADO",
      numeroAutorizacion:
        authResponse.autorizacion?.numeroAutorizacion ?? null,
    });
  } catch (err: any) {
    console.error("AUTHORIZE-INVOICE ERROR:", err);

    return json(500, {
      ok: false,
      error: err?.message ?? "Internal error authorizing invoice",
    });
  }
};

/* ======================================================
   JSON HELPER
====================================================== */
function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}