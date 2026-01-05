// netlify/functions/_lib/sriInvoiceXml.ts
import { createHash } from "crypto";

interface BuildXmlParams {
  entity: any;
  invoice: any;
  accessKey: string;
}

export function buildSriInvoiceXml({
  entity,
  invoice,
  accessKey,
}: BuildXmlParams): string {
  const issueDate = invoice.issueDate.split("-").reverse().join("/");

  return `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${entity.sriSettings.ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${entity.name}</razonSocial>
    <nombreComercial>${entity.tradeName ?? entity.name}</nombreComercial>
    <ruc>${entity.ruc}</ruc>
    <claveAcceso>${accessKey}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${entity.sriSettings.estab}</estab>
    <ptoEmi>${entity.sriSettings.ptoEmi}</ptoEmi>
    <secuencial>${invoice.secuencial}</secuencial>
    <dirMatriz>${entity.address}</dirMatriz>
  </infoTributaria>

  <infoFactura>
    <fechaEmision>${issueDate}</fechaEmision>
    <dirEstablecimiento>${entity.address}</dirEstablecimiento>
    <obligadoContabilidad>SI</obligadoContabilidad>
    <tipoIdentificacionComprador>${mapIdType(invoice.customer.identificationType)}</tipoIdentificacionComprador>
    <razonSocialComprador>${invoice.customer.name}</razonSocialComprador>
    <identificacionComprador>${invoice.customer.identification}</identificacionComprador>
    <totalSinImpuestos>${invoice.totals.subtotalSinImpuestos.toFixed(2)}</totalSinImpuestos>
    <totalDescuento>${invoice.totals.discountTotal.toFixed(2)}</totalDescuento>

    <totalConImpuestos>
      ${buildTaxTotals(invoice)}
    </totalConImpuestos>

    <importeTotal>${invoice.totals.total.toFixed(2)}</importeTotal>
    <moneda>USD</moneda>
  </infoFactura>

  <detalles>
    ${buildItems(invoice)}
  </detalles>
</factura>`;
}

/* ===================== helpers ===================== */

function mapIdType(type: string) {
  if (type === "ruc") return "04";
  if (type === "cedula") return "05";
  return "06"; // pasaporte
}

function buildTaxTotals(invoice: any) {
  const iva = invoice.totals.ivaByRate[12] ?? 0;

  return `
  <totalImpuesto>
    <codigo>2</codigo>
    <codigoPorcentaje>2</codigoPorcentaje>
    <baseImponible>${invoice.totals.subtotalSinImpuestos.toFixed(2)}</baseImponible>
    <valor>${iva.toFixed(2)}</valor>
  </totalImpuesto>`;
}

function buildItems(invoice: any) {
  return invoice.items
    .map(
      (it: any) => `
    <detalle>
      <descripcion>${it.description}</descripcion>
      <cantidad>${it.quantity}</cantidad>
      <precioUnitario>${it.unitPrice.toFixed(2)}</precioUnitario>
      <descuento>${(it.discount ?? 0).toFixed(2)}</descuento>
      <precioTotalSinImpuesto>${it.subtotal.toFixed(2)}</precioTotalSinImpuesto>

      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>2</codigoPorcentaje>
          <tarifa>12</tarifa>
          <baseImponible>${it.subtotal.toFixed(2)}</baseImponible>
          <valor>${it.ivaValue.toFixed(2)}</valor>
        </impuesto>
      </impuestos>
    </detalle>`
    )
    .join("");
}