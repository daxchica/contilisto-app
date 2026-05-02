import type { Invoice, TaxRate } from "@/types/Invoice";

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

function ivaCode(rate: TaxRate): string {
  if (rate === 0) return "0";
  if (rate === 12) return "2";
  if (rate === 15) return "4";
  return "0";
}

function buildTotalImpuesto(rate: TaxRate, base: number, iva: number): string {
  if (base <= 0) return "";

  return `
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${ivaCode(rate)}</codigoPorcentaje>
        <baseImponible>${n(base)}</baseImponible>
        <valor>${n(iva)}</valor>
      </totalImpuesto>`;
}

function buildItemImpuesto(rate: TaxRate, base: number, iva: number): string {
  if (base <= 0) return "";

  return `
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${ivaCode(rate)}</codigoPorcentaje>
          <tarifa>${n(rate, 0)}</tarifa>
          <baseImponible>${n(base)}</baseImponible>
          <valor>${n(iva)}</valor>
        </impuesto>`;
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

  const subtotal0 = invoice.totals.subtotalsByRate[0] ?? 0;
  const subtotal12 = invoice.totals.subtotalsByRate[12] ?? 0;
  const subtotal15 = invoice.totals.subtotalsByRate[15] ?? 0;

  const iva12 = invoice.totals.ivaByRate[12] ?? 0;
  const iva15 = invoice.totals.ivaByRate[15] ?? 0;

  const totalSinImpuestos = 
    invoice.totals.subtotalSinImpuestos ??
    subtotal0 + subtotal12 + subtotal15;
  
  const totalDescuento = 
    invoice.totals.discountTotal ??
    invoice.items.reduce((sum, i) => sum + Number(i.discount ?? 0), 0);

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
      ${buildTotalImpuesto(0, subtotal0, 0)}
      ${buildTotalImpuesto(12, subtotal12, iva12)}
      ${buildTotalImpuesto(15, subtotal15, iva15)}
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
  .map((i) => {
    const rate = Number(i.ivaRate ?? 0) as TaxRate;

    return `
    <detalle>
      <codigoPrincipal>${xmlEscape(i.id ?? "ITEM")}</codigoPrincipal>
      <descripcion>${xmlEscape(i.description)}</descripcion>
      <cantidad>${n(i.quantity, 6)}</cantidad>
      <precioUnitario>${n(i.unitPrice, 6)}</precioUnitario>
      <descuento>${n(i.discount ?? 0)}</descuento>
      <precioTotalSinImpuesto>${n(i.subtotal)}</precioTotalSinImpuesto>
      <impuestos>
${buildItemImpuesto(rate, i.subtotal, i.ivaValue ?? 0)}
      </impuestos>
    </detalle>`;
  })
  .join("")}
  </detalles>
</factura>`;
}