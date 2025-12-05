// src/utils/sriInvoiceXml.ts
import type { InvoiceItem } from "@/types/InvoiceItem";
import type { Client } from "@/services/clientService";
import type { Entity } from "@/types/Entity";
import type { Invoice } from "@/types/Invoice"; // adjust path to where you defined Invoice

function escapeXml(raw: string | number | undefined | null): string {
  const str = String(raw ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDateDDMMYYYY(timestamp: number): string {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function mapIvaRateToCodigoPorcentaje(ivaRate: number): string {
  // Simplified mapping for SRI (can be extended)
  if (ivaRate === 0) return "0";  // IVA 0%
  if (ivaRate === 12) return "2"; // IVA 12%
  return "2"; // default to standard IVA
}

export function buildSriInvoiceXml(params: {
  invoice: Invoice;
  issuer: Entity;
  client: Client;
}): string {
  const { invoice, issuer, client } = params;
  const items = invoice.items as InvoiceItem[];

  const issueDate = formatDateDDMMYYYY(invoice.issueDate);

  const subtotal0 = items
    .filter((i) => i.ivaRate === 0)
    .reduce((sum, i) => sum + i.subtotal, 0);

  const subtotalIva = items
    .filter((i) => i.ivaRate !== 0)
    .reduce((sum, i) => sum + i.subtotal, 0);

  const ivaTotal = items.reduce((sum, i) => sum + i.ivaValue, 0);
  const total = items.reduce((sum, i) => sum + i.total, 0);

  const detallesXml = items
    .map((item, idx) => {
      const codigoPorcentaje = mapIvaRateToCodigoPorcentaje(item.ivaRate);
      const baseImponible = item.subtotal;
      const valor = item.ivaValue;

      return `
      <detalle>
        <codigoPrincipal>${escapeXml(item.productCode || `ITEM-${idx + 1}`)}</codigoPrincipal>
        <codigoAuxiliar>${escapeXml(item.sriCode || "")}</codigoAuxiliar>
        <descripcion>${escapeXml(item.description)}</descripcion>
        <cantidad>${item.quantity}</cantidad>
        <precioUnitario>${formatMoney(item.unitPrice)}</precioUnitario>
        <descuento>${formatMoney(item.discount ?? 0)}</descuento>
        <precioTotalSinImpuesto>${formatMoney(baseImponible)}</precioTotalSinImpuesto>
        <impuestos>
          <impuesto>
            <codigo>2</codigo> <!-- 2 = IVA -->
            <codigoPorcentaje>${codigoPorcentaje}</codigoPorcentaje>
            <tarifa>${item.ivaRate}</tarifa>
            <baseImponible>${formatMoney(baseImponible)}</baseImponible>
            <valor>${formatMoney(valor)}</valor>
          </impuesto>
        </impuestos>
      </detalle>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="2.1.0">
  <infoTributaria>
    <ambiente>1</ambiente> <!-- 1 = pruebas, 2 = producción -->
    <tipoEmision>1</tipoEmision>
    <razonSocial>${escapeXml(issuer.name)}</razonSocial>
    <nombreComercial>${escapeXml(issuer.name)}</nombreComercial>
    <ruc>${escapeXml(issuer.ruc)}</ruc>
    <claveAcceso>${escapeXml(invoice.sriAccessKey || "")}</claveAcceso>
    <codDoc>01</codDoc> <!-- 01 = factura -->
    <estab>001</estab>
    <ptoEmi>001</ptoEmi>
    <secuencial>${escapeXml(invoice.id.padStart(9, "0"))}</secuencial>
    <dirMatriz>DIR MATRIZ PENDIENTE</dirMatriz>
  </infoTributaria>

  <infoFactura>
    <fechaEmision>${issueDate}</fechaEmision>
    <dirEstablecimiento>DIR ESTABLECIMIENTO PENDIENTE</dirEstablecimiento>
    <obligadoContabilidad>SI</obligadoContabilidad>
    <tipoIdentificacionComprador>${escapeXml(
      client.tipo_identificacion === "ruc"
        ? "04"
        : client.tipo_identificacion === "cedula"
        ? "05"
        : "06" // pasaporte u otros
    )}</tipoIdentificacionComprador>
    <razonSocialComprador>${escapeXml(client.razon_social)}</razonSocialComprador>
    <identificacionComprador>${escapeXml(client.identificacion)}</identificacionComprador>
    <totalSinImpuestos>${formatMoney(subtotal0 + subtotalIva)}</totalSinImpuestos>
    <totalDescuento>0.00</totalDescuento>
    <totalConImpuestos>
      ${
        subtotal0 > 0
          ? `
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>0</codigoPorcentaje>
        <baseImponible>${formatMoney(subtotal0)}</baseImponible>
        <valor>0.00</valor>
      </totalImpuesto>`
          : ""
      }
      ${
        subtotalIva > 0
          ? `
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>2</codigoPorcentaje>
        <baseImponible>${formatMoney(subtotalIva)}</baseImponible>
        <valor>${formatMoney(ivaTotal)}</valor>
      </totalImpuesto>`
          : ""
      }
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${formatMoney(total)}</importeTotal>
    <moneda>DOLAR</moneda>
  </infoFactura>

  <detalles>
    ${detallesXml}
  </detalles>
</factura>`;

  return xml.trim();
}