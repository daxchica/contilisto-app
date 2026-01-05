import type { Handler } from "@netlify/functions";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import type { Invoice } from "@/types/Invoice";
import { buildSriInvoiceXml } from "./buildSriInvoiceXml";
import { signXmlDummy } from "./signXmlBs";

/* ==============================
   FIREBASE ADMIN INIT
============================== */

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

/* ==============================
   HANDLER
============================== */

export const handler: Handler = async (event) => {
  try {
    const { entityId, invoiceId } = JSON.parse(event.body || "{}");

    if (!entityId || !invoiceId) {
      return {
        statusCode: 400,
        body: "entityId e invoiceId requeridos",
      };
    }

    /* 1️⃣ Cargar factura */
    const ref = db
      .collection("entities")
      .doc(entityId)
      .collection("invoices")
      .doc(invoiceId);

    const snap = await ref.get();

    if (!snap.exists) {
      return {
        statusCode: 404,
        body: "Factura no encontrada",
      };
    }

    const invoice = {
      id: snap.id,
      entityId,
      ...(snap.data() as Omit<Invoice, "id" | "entityId">),
    } as Invoice;

    if (invoice.status !== "draft") {
      return {
        statusCode: 400,
        body: "Solo se pueden emitir facturas en borrador",
      };
    }

    /* 2️⃣ Generar XML SRI */
    const ambiente: "1" | "2" =
      process.env.SRI_AMBIENTE === "2" ? "2" : "1";

    const xml = buildSriInvoiceXml(invoice, { ambiente });

    /* 3️⃣ Firmar XML (dummy por ahora) */
    const xmlSigned = await signXmlDummy(xml);

    /* 4️⃣ Guardar resultado */
    await ref.update({
      status: "issued",
      issuedAt: Date.now(),
      updatedAt: Date.now(),
      sri: {
        ambiente,
        xml,
        xmlSigned,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        invoiceId,
        ambiente,
      }),
    };
  } catch (err: any) {
    console.error("❌ issue-invoice error:", err);

    return {
      statusCode: 500,
      body: err?.message || "Error emitiendo factura",
    };
  }
};