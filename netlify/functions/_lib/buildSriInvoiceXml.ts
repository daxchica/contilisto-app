import type { Invoice } from "@/types/Invoice";

/* ==============================
   HELPERS
============================== */

function formatDateSri(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function n(v: number, dec = 2): string {
  return Number(v ?? 0).toFixed(dec);
}

function xmlEscape(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buyerIdType(type?: string): "04" | "05" | "06" | "07" {
  if (type === "consumidor_final") return "07";
  if (type === "cedula") return "05";
  if (type === "pasaporte") return "06";
  return "04"; // RUC
}

/* ==============================
   XML BUILDER (MVP SRI REAL)
============================== */

export function buildSriInvoiceXml(
  invoice: Invoice,
  issuer: {
    razonSocial: string;
    ruc: string;
    estab: string;
    ptoEmi: string;
    secuencial: string;
    ambiente: "1" | "2";
    claveAcceso: string;
    dirMatriz?: string;
  }
): string {

  const fechaEmision = formatDateSri(invoice.issueDate);

  const totalSinImpuestos =
    invoice.totals.subtotal0 + invoice.totals.subtotal15;

  const totalDescuento = invoice.items.reduce(
    (sum, i) => sum + (i.discount ?? 0),
    0
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${issuer.ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${xmlEscape(issuer.razonSocial)}</razonSocial>
    <nombreComercial>${xmlEscape(issuer.razonSocial)}</nombreComercial>
    <ruc>${issuer.ruc}</ruc>
    <claveAcceso>${issuer.claveAcceso}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${issuer.estab}</estab>
    <ptoEmi>${issuer.ptoEmi}</ptoEmi>
    <secuencial>${issuer.secuencial}</secuencial>
    <dirMatriz>${xmlEscape(issuer.dirMatriz ?? "NO DEFINIDO")}</dirMatriz>
  </infoTributaria>

  <infoFactura>
    <fechaEmision>${fechaEmision}</fechaEmision>
    <tipoIdentificacionComprador>${buyerIdType(invoice.customer.identificationType)}</tipoIdentificacionComprador>
    <razonSocialComprador>${xmlEscape(invoice.customer.name)}</razonSocialComprador>
    <identificacionComprador>${invoice.customer.identification}</identificacionComprador>

    <totalSinImpuestos>${n(totalSinImpuestos)}</totalSinImpuestos>
    <totalDescuento>${n(totalDescuento)}</totalDescuento>

    <totalConImpuestos>
      ${
        invoice.totals.subtotal15 > 0
          ? `<totalImpuesto>
              <codigo>2</codigo>
              <codigoPorcentaje>2</codigoPorcentaje>
              <baseImponible>${n(invoice.totals.subtotal15)}</baseImponible>
              <valor>${n(invoice.totals.iva15)}</valor>
            </totalImpuesto>`
          : ""
      }
    </totalConImpuestos>

    <propina>0.00</propina>
    <importeTotal>${n(invoice.totals.total)}</importeTotal>
    <moneda>USD</moneda>

    <pagos>
      <pago>
        <formaPago>01</formaPago>
        <total>${n(invoice.totals.total)}</total>
      </pago>
    </pagos>
  </infoFactura>

  <detalles>
    ${invoice.items
      .map(
        (i) => `
    <detalle>
      <descripcion>${xmlEscape(i.description)}</descripcion>
      <cantidad>${n(i.quantity)}</cantidad>
      <precioUnitario>${n(i.unitPrice)}</precioUnitario>
      <descuento>${n(i.discount ?? 0)}</descuento>
      <precioTotalSinImpuesto>${n(i.subtotal)}</precioTotalSinImpuesto>
      <impuestos>
        ${
          i.ivaRate === 12
            ? `<impuesto>
                <codigo>2</codigo>
                <codigoPorcentaje>2</codigoPorcentaje>
                <tarifa>12</tarifa>
                <baseImponible>${n(i.subtotal)}</baseImponible>
                <valor>${n(i.ivaValue)}</valor>
              </impuesto>`
            : ""
        }
      </impuestos>
    </detalle>`
      )
      .join("")}
  </detalles>
</factura>`;
}