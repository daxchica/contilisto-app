import type { Handler } from "@netlify/functions";
import { FieldValue } from "firebase-admin/firestore";

import type { Invoice } from "@/types/Invoice";
import { adminDb } from "../_server/firebaseAdmin";
import { buildSriInvoiceXml } from "./buildSriInvoiceXml";
import { signXmlDummy } from "./signXmlBs";
import { generateAccessKey } from "../sri/generateAccessKey";

/* ==============================
   HANDLER
============================== */

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const { entityId, invoiceId } = JSON.parse(event.body || "{}");

    if (!entityId || !invoiceId) {
      return json(400, {
        error: "entityId e invoiceId son requeridos",
      });
    }

    /* ============================
       1️⃣ Load ENTITY (issuer)
    ============================ */
    const entityRef = adminDb.doc(`entities/${entityId}`);
    const entitySnap = await entityRef.get();

    if (!entitySnap.exists) {
      return json(404, { error: "Entidad no encontrada" });
    }

    const entity = entitySnap.data()!;
    const sriSettings = entity.sriSettings;

    if (!sriSettings) {
      return json(400, {
        error: "La empresa no tiene configuración SRI",
      });
    }

    function generateSecuencial(): string {
      return Date.now().toString().slice(-9);
    }

    /* ============================
       2️⃣ Load invoice
    ============================ */
    const invoiceRef = adminDb.doc(
      `entities/${entityId}/invoices/${invoiceId}`
    );
    const invoiceSnap = await invoiceRef.get();

    if (!invoiceSnap.exists) {
      return json(404, { error: "Factura no encontrada" });
    }

    const invoice = {
      id: invoiceSnap.id,
      entityId,
      ...(invoiceSnap.data() as Omit<Invoice, "id" | "entityId">),
    } as Invoice;

    if (invoice.status !== "draft") {
      return json(400, {
        error: `Estado inválido: ${invoice.status}`,
      });
    }

    /* ============================
       3️⃣ Build SRI XML
    ============================ */
    const ambiente: "1" | "2" =
      process.env.SRI_AMBIENTE === "2" ? "2" : "1";

    const secuencial = generateSecuencial();

    const claveAcceso = generateAccessKey({
      date: invoice.issueDate ?? new Date().toISOString().slice(0, 10),
      docType: "01",
      ruc: sriSettings.ruc,
      ambiente,
      estab: sriSettings.estab ?? "001",
      ptoEmi: sriSettings.ptoEmi ?? "001",
      secuencial,
    });

    const xml = buildSriInvoiceXml(invoice, {
      ambiente,
      razonSocial: sriSettings.razonSocial,
      ruc: sriSettings.ruc,
      estab: sriSettings.estab ?? "001",
      ptoEmi: sriSettings.ptoEmi ?? "001",
      secuencial,
      claveAcceso,
      dirMatriz: sriSettings.dirMatriz,
    });

    /* ============================
       4️⃣ Sign XML (dummy)
    ============================ */
    const xmlSigned = await signXmlDummy(xml);

    /* ============================
       5️⃣ Persist
    ============================ */
    await invoiceRef.update({
      status: "issued",
      issuedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      secuencial,
      claveAcceso,
      sri: {
        ambiente,
        xml,
        xmlSigned,
      },
    });

    return json(200, {
      ok: true,
      invoiceId,
      ambiente,
    });
  } catch (err: any) {
    console.error("❌ issue-invoice error:", err);

    return json(500, {
      error: err?.message || "Error emitiendo factura",
    });
  }
};

/* =========================
   Helper
========================== */
function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}