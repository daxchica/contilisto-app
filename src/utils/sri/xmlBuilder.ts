// src/utils/sri/xmlBuilder.ts

import type { Invoice, InvoiceSri } from "@/types/Invoice";

/* =====================================================
   ACCESS KEY (CLAVE DE ACCESO) – SRI MOD 11
===================================================== */

export function generateAccessKey(params: {
  date: string;       // YYYYMMDD
  docType: string;    // 01 = factura
  ruc: string;
  ambiente: string;  // 1 | 2
  estab: string;
  ptoEmi: string;
  secuencial: string;
}): string {
  const raw =
    params.date +
    params.docType +
    params.ruc +
    params.ambiente +
    params.estab +
    params.ptoEmi +
    params.secuencial +
    "12345678" + // código numérico (puede parametrizarse luego)
    "1";         // tipo emisión

  const mod11 = computeMod11(raw);
  return raw + mod11;
}

function computeMod11(input: string): string {
  let sum = 0;
  let factor = 2;

  for (let i = input.length - 1; i >= 0; i--) {
    sum += Number(input[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }

  const mod = 11 - (sum % 11);
  if (mod === 11) return "0";
  if (mod === 10) return "1";
  return mod.toString();
}

/* =====================================================
   XML BUILDER – FACTURA ELECTRÓNICA SRI
===================================================== */

export function buildSriInvoiceXml(params: {
  invoice: Invoice;
  sri: InvoiceSri;
  issuer: {
    razonSocial: string;
    nombreComercial?: string;
    ruc: string;
    direccionMatriz: string;
  };
}): {
  xml: string;
  claveAcceso: string;
} {
  const { invoice, sri, issuer } = params;

  /* =============================
     CLAVE DE ACCESO
  ============================= */
  const claveAcceso = generateAccessKey({
    date: invoice.issueDate.replace(/-/g, ""), // YYYYMMDD
    docType: "01",
    ruc: issuer.ruc,
    ambiente: sri.ambiente,
    estab: sri.estab,
    ptoEmi: sri.ptoEmi,
    secuencial: sri.secuencial,
  });

  /* =============================
     INFO TRIBUTARIA
  ============================= */
  const infoTributaria = `
<infoTributaria>
  <ambiente>${sri.ambiente}</ambiente>
  <tipoEmision>1</tipoEmision>
  <razonSocial>${issuer.razonSocial}</razonSocial>
  ${
    issuer.nombreComercial
      ? `<nombreComercial>${issuer.nombreComercial}</nombreComercial>`
      : ""
  }
  <ruc>${issuer.ruc}</ruc>
  <claveAcceso>${claveAcceso}</claveAcceso>
  <codDoc>01</codDoc>
  <estab>${sri.estab}</estab>
  <ptoEmi>${sri.ptoEmi}</ptoEmi>
  <secuencial>${sri.secuencial}</secuencial>
  <dirMatriz>${issuer.direccionMatriz}</dirMatriz>
</infoTributaria>`.trim();

  /* =============================
     INFO FACTURA
  ============================= */
  const infoFactura = `
<infoFactura>
  <fechaEmision>${invoice.issueDate.split("-").reverse().join("/")}</fechaEmision>
  <tipoIdentificacionComprador>${
    invoice.customer.identificationType === "ruc" ? "04" : "05"
  }</tipoIdentificacionComprador>
  <razonSocialComprador>${invoice.customer.name}</razonSocialComprador>
  <identificacionComprador>${invoice.customer.identification}</identificacionComprador>
  <totalSinImpuestos>${invoice.totals.subtotalSinImpuestos.toFixed(2)}</totalSinImpuestos>
  <importeTotal>${invoice.totals.total.toFixed(2)}</importeTotal>
  <moneda>USD</moneda>
</infoFactura>`.trim();

  /* =============================
     DETALLES
  ============================= */
  const detalles = `
<detalles>
  ${invoice.items
    .map(
      (item) => `
  <detalle>
    <descripcion>${item.description}</descripcion>
    <cantidad>${item.quantity}</cantidad>
    <precioUnitario>${item.unitPrice.toFixed(2)}</precioUnitario>
    <precioTotalSinImpuesto>${item.subtotal.toFixed(2)}</precioTotalSinImpuesto>
  </detalle>`
    )
    .join("")}
</detalles>`.trim();

  /* =============================
     XML FINAL
  ============================= */
  const xml = `
<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  ${infoTributaria}
  ${infoFactura}
  ${detalles}
</factura>
`.trim();

  return {
    xml,
    claveAcceso,
  };
}