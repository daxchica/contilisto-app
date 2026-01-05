// netlify/functions/sign-invoice.ts
import type { Handler } from "@netlify/functions";
import { admin, adminDb } from "./_lib/firebaseAdmin";


import {
  extractFromP12,
  signXmlXadesBes,
} from "./_lib/sriXadesSign";

const bucket = admin.storage().bucket(
  process.env.FIREBASE_STORAGE_BUCKET
);

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { 
        ok: false,
        error: "Method not allowed",
      });
    }

    const { entityId, invoiceId, p12Password } =
      JSON.parse(event.body || "{}");

    if (!entityId || !invoiceId || !p12Password) {
      return json(400, {
        ok: false,
        error: "entityId, invoiceId y p12Password son requeridos",
      });
    }

    /* ================================
        Load entity
    =================================*/
    const entityRef = adminDb.doc(`entities/${entityId}`);
    const entitySnap = await entityRef.get();
    
    if (!entitySnap.exists) {
      return json(404, { ok: false, error: "Entidad no encontrada" });
    }

    const p12Path = entitySnap.data()?.sriSettings?.p12?.storagePath;
    if (!p12Path) {
      return json(400, {
        ok: false,
        error: "Certificado P12 no configurado"
      });
    }

    /* =============================
       Load invoice
    ============================= */

    const invoiceRef = adminDb.doc(
      `entities/${entityId}/invoices/${invoiceId}`
    );
    const invoiceSnap = await invoiceRef.get();

    if (!invoiceSnap.exists) {
      return json(404, { ok: false, error: "Factura no encontrada" });
    }

    const invoice = invoiceSnap.data()!;

    if (invoice.status !== "pending-sign") {
      return json(400, {
        ok: false,
        error: `Estado inválido para firma: ${invoice.status}`
      });
    }

    if (!invoice.xml) {
      return json(400, {
        ok: false,
        error: "XML de factura no encontrado",
      });
    }

    /* =============================
       Download P12
    ============================= */

    const [p12Buffer] = await bucket.file(p12Path).download();

    /* =============================
       Extract certificate
    ============================= */

    let privateKeyPem, certPem, cert;

    try {
      ({ privateKeyPem, certPem, cert } = extractFromP12(
      p12Buffer.toString("base64"),
      p12Password
    ));
  } catch {
    return json(401, {
      ok: false,
      error: "Contrasena del certificado digital incorrecta.",
    });
  }

    /* =============================
       Sign XML
    ============================= */
    const signedXml = signXmlXadesBes({
      xml: invoice.xml,
      privateKeyPem,
      certPem,
      cert,
    });

    /* ============================
        Persist
    =============================*/

    await invoiceRef.update({
      xmlSigned: signedXml,
      status: "signed",
      signedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return json(200, {
      ok: true,
      message: "Factura firmada correctamente",
    });
  } catch (e: any) {
    console.error("SIGN-INVOICE ERROR:", e);
    return json(500, {
      ok: false,
      error: e?.message ?? "Error interno al firmar factura",
    });
  }
};

/* =========================
    Helper
========================== */
function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }
}