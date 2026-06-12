// netlify/functions/authorize-invoice.ts
import { admin, adminDb } from "./_server/firebaseAdmin";
import { authorizeFromSri } from "./sri/authorizeFromSri";

export default async (req: Request): Promise<Response> => {
  try {
    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    const { entityId, invoiceId } = await req.json();

    if (!entityId || !invoiceId) {
      return Response.json({ ok: false, error: "entityId and invoiceId are required" }, { status: 400 });
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

    if (invoice.status !== "sent-sri") {
      return Response.json({ ok: false, error: `Invoice must be SENT-SRI. Current: ${invoice.status}` }, { status: 400 });
    }

    if (!invoice.sri?.claveAcceso) {
      return Response.json({ ok: false, error: "claveAcceso missing on invoice.sri" }, { status: 400 });
    }

    if (!invoice.sri?.estadoRecepcion) {
      return Response.json({ ok: false, error: "estadoRecepcion missing on invoice.sri" }, { status: 400 });
    }

    if (invoice.sri.estadoRecepcion !== "RECIBIDA") {
      return Response.json({ ok: false, error: `Cannot authorize invoice with estadoRecepcion=${invoice.sri.estadoRecepcion}` }, { status: 400 });
    }

    const environment = invoice.sri.ambiente ?? "1";

    const authResponse = await authorizeFromSri({
      environment,
      accessKey: invoice.sri.claveAcceso,
    });

    const autorizado = authResponse.autorizacion?.estado === "AUTORIZADO";

    await invoiceRef.update({
      status: autorizado ? "authorized" : "rejected",
      "sri.autorizacion": {
        estado: authResponse.autorizacion?.estado ?? "NO AUTORIZADO",
        numeroAutorizacion: authResponse.autorizacion?.numeroAutorizacion ?? null,
        fechaAutorizacion: authResponse.autorizacion?.fechaAutorizacion ?? null,
        xmlAutorizado: authResponse.autorizacion?.comprobante ?? null,
        mensajes: authResponse.autorizacion?.mensajes ?? [],
        raw: authResponse.raw,
      },
      "sri.authorizedAt": admin.firestore.FieldValue.serverTimestamp(),
    });

    return Response.json({
      ok: true,
      claveAcceso: invoice.sri.claveAcceso,
      estado: autorizado ? "AUTORIZADO" : "NO AUTORIZADO",
      numeroAutorizacion: authResponse.autorizacion?.numeroAutorizacion ?? null,
    });
  } catch (err: any) {
    console.error("AUTHORIZE-INVOICE ERROR:", err);
    return Response.json({ ok: false, error: err?.message ?? "Internal error authorizing invoice" }, { status: 500 });
  }
};
