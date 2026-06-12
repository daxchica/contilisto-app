// netlify/functions/sign-invoice.ts
import { admin, adminDb, getAdminBucket } from "./_server/firebaseAdmin";
import { extractFromP12, signXmlXadesBes } from "./_lib/sriXadesSign";

export default async (req: Request): Promise<Response> => {
  try {
    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    const { entityId, invoiceId, p12Password } = await req.json();

    if (!entityId || !invoiceId || !p12Password) {
      return Response.json({ ok: false, error: "entityId, invoiceId y p12Password son requeridos" }, { status: 400 });
    }

    const entityRef = adminDb.doc(`entities/${entityId}`);
    const entitySnap = await entityRef.get();

    if (!entitySnap.exists) {
      return Response.json({ ok: false, error: "Entidad no encontrada" }, { status: 404 });
    }

    const p12Path = entitySnap.data()?.sriSettings?.p12?.storagePath;
    if (!p12Path) {
      return Response.json({ ok: false, error: "Certificado P12 no configurado" }, { status: 400 });
    }

    const invoiceRef = adminDb.doc(`entities/${entityId}/invoices/${invoiceId}`);
    const invoiceSnap = await invoiceRef.get();

    if (!invoiceSnap.exists) {
      return Response.json({ ok: false, error: "Factura no encontrada" }, { status: 404 });
    }

    const invoice = invoiceSnap.data()!;

    if (invoice.status !== "pending-sign") {
      return Response.json({ ok: false, error: `Estado inválido para firma: ${invoice.status}` }, { status: 400 });
    }

    if (!invoice.xml) {
      return Response.json({ ok: false, error: "XML de factura no encontrado" }, { status: 400 });
    }

    const bucket = getAdminBucket();
    const [p12Buffer] = await bucket.file(p12Path).download();

    let privateKeyPem: string, certPem: string, cert: any;
    try {
      ({ privateKeyPem, certPem, cert } = extractFromP12(p12Buffer.toString("base64"), p12Password));
    } catch {
      return Response.json({ ok: false, error: "Contrasena del certificado digital incorrecta." }, { status: 401 });
    }

    const signedXml = signXmlXadesBes({ xml: invoice.xml, privateKeyPem, certPem, cert });

    await invoiceRef.update({
      xmlSigned: signedXml,
      status: "signed",
      signedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return Response.json({ ok: true, message: "Factura firmada correctamente" });
  } catch (e: any) {
    console.error("SIGN-INVOICE ERROR:", e);
    return Response.json({ ok: false, error: e?.message ?? "Error interno al firmar factura" }, { status: 500 });
  }
};
