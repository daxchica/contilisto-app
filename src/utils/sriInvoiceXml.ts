// src/utils/sriInvoiceXml.ts
import type { Contact } from "@/types/Contact";
import type { Entity } from "@/types/Entity";
import type { Invoice } from "@/types/Invoice";

/* =======================
   Helpers
======================= */

function escapeXml(value?: string | number | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatMoney(n: number): string {
  return round2(n).toFixed(2);
}

function formatDateDDMMYYYY(value: number | string): string {
  const d = new Date(value);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function ivaRateToCodigoPorcentaje(rate: number): string {
  if (rate === 0) return "0";
  if (rate === 12) return "2";
  if (rate === 15) return "4";
  return "2";
}

function buildBuyerIdentificationType(
  client: Contact
): "04" | "05" | "06" | "07" {
  const t = (client.identificationType ?? "").toLowerCase();
  if (t === "consumidor_final") return "07";
  if (t === "cedula" || t === "cédula") return "05";
  if (t === "pasaporte") return "06";
  return "04"; // RUC
}

/* =======================
   XML Builder
======================= */

export function buildSriInvoiceXml(params: {
  invoice: Invoice;
  issuer: Entity;
  issuerAddress: string;
  client: Contact;
  ambiente: "1" | "2";
  estab: string;
  ptoEmi: string;
  secuencial: string;
}): { xml: string } {
  const {
    invoice,
    issuer,
    issuerAddress,
    client,
    ambiente,
    estab,
    ptoEmi,
    secuencial,
  } = params;

  const items = invoice.items ?? [];

  const taxBuckets = new Map<number, { base: number; iva: number }>();
  let totalSinImpuestos = 0;
  let totalDescuento = 0;
  let importeTotal = 0;

  const detallesXml = items
    .map((item, idx) => {
      const qty = round2(item.quantity);
      const unit = round2(item.unitPrice);
      const rate = item.ivaRate;
      const discount = round2(item.discount ?? 0);

      const base = round2(qty * unit - discount);
      const iva = round2(base * (rate / 100));
      const totalLinea = round2(base + iva);

      totalSinImpuestos += base;
      totalDescuento += discount;
      importeTotal += totalLinea;

      const bucket = taxBuckets.get(rate) ?? { base: 0, iva: 0 };
      bucket.base += base;
      bucket.iva += iva;
      taxBuckets.set(rate, bucket);

      const codigoPrincipal = (item as any).productCode || item.id || `ITEM-${idx + 1}`;

      return `
      <detalle>
        <codigoPrincipal>${escapeXml(codigoPrincipal)}</codigoPrincipal>
        <descripcion>${escapeXml(item.description)}</descripcion>
        <cantidad>${formatMoney(qty)}</cantidad>
        <precioUnitario>${formatMoney(unit)}</precioUnitario>
        <descuento>${formatMoney(discount)}</descuento>
        <precioTotalSinImpuesto>${formatMoney(base)}</precioTotalSinImpuesto>
        <impuestos>
          <impuesto>
            <codigo>2</codigo>
            <codigoPorcentaje>${ivaRateToCodigoPorcentaje(rate)}</codigoPorcentaje>
            <tarifa>${formatMoney(rate)}</tarifa>
            <baseImponible>${formatMoney(base)}</baseImponible>
            <valor>${formatMoney(iva)}</valor>
          </impuesto>
        </impuestos>
      </detalle>`;
    })
    .join("");

  const totalConImpuestosXml = Array.from(taxBuckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, v]) => `
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${ivaRateToCodigoPorcentaje(rate)}</codigoPorcentaje>
        <baseImponible>${formatMoney(v.base)}</baseImponible>
        <valor>${formatMoney(v.iva)}</valor>
      </totalImpuesto>
    `)
    .join("");

  const tipoIdentificacionComprador =
    buildBuyerIdentificationType(client);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${escapeXml(issuer.name)}</razonSocial>
    <nombreComercial>${escapeXml(issuer.name)}</nombreComercial>
    <ruc>${escapeXml(issuer.ruc)}</ruc>
    <codDoc>01</codDoc>
    <estab>${escapeXml(estab)}</estab>
    <ptoEmi>${escapeXml(ptoEmi)}</ptoEmi>
    <secuencial>${escapeXml(secuencial)}</secuencial>
    <dirMatriz>${escapeXml(issuerAddress)}</dirMatriz>
  </infoTributaria>

  <infoFactura>
    <fechaEmision>${formatDateDDMMYYYY(invoice.issueDate)}</fechaEmision>
    <dirEstablecimiento>${escapeXml(issuerAddress)}</dirEstablecimiento>
    <obligadoContabilidad>${issuer.obligadoContabilidad ? "SI" : "NO"}</obligadoContabilidad>

    <tipoIdentificacionComprador>${tipoIdentificacionComprador}</tipoIdentificacionComprador>
    <razonSocialComprador>${escapeXml(client.name)}</razonSocialComprador>
    <identificacionComprador>${escapeXml(client.identification)}</identificacionComprador>

    <totalSinImpuestos>${formatMoney(totalSinImpuestos)}</totalSinImpuestos>
    <totalDescuento>${formatMoney(totalDescuento)}</totalDescuento>

    <totalConImpuestos>
      ${totalConImpuestosXml}
    </totalConImpuestos>

    <propina>0.00</propina>
    <importeTotal>${formatMoney(importeTotal)}</importeTotal>
    <moneda>USD</moneda>
  </infoFactura>

  <detalles>
    ${detallesXml}
  </detalles>

  <infoAdicional>
    ${client.email ? `<campoAdicional nombre="Email">${escapeXml(client.email)}</campoAdicional>` : ""}
    ${client.address ? `<campoAdicional nombre="Direccion">${escapeXml(client.address)}</campoAdicional>` : ""}
  </infoAdicional>
</factura>`.trim();

  return { xml };
}