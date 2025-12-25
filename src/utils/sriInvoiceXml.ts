// src/utils/sriInvoiceXml.ts
import type { InvoiceItem } from "@/types/InvoiceItem";
import type { Contact } from "@/types/Contact";
import type { Entity } from "@/types/Entity";
import type { Invoice } from "@/types/Invoice";
import { buildSriAccessKey } from "@/utils/sriAccessKey";

function escapeXml(value?: string | number | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toNumber(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function formatMoney(n: number): string {
  return (Number(n) || 0).toFixed(2);
}

function formatDateDDMMYYYY(value: number | string): string {
  const d = typeof value === "string" ? new Date(value) : new Date(value);
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

function buildBuyerIdentificationType(client: Contact): "04" | "05" | "06" {
  // 04 RUC, 05 Cédula, 06 Pasaporte
  const t = (client.identificationType ?? "").toLowerCase();
  if (t === "cedula" || t === "cédula") return "05";
  if (t === "pasaporte") return "06";
  return "04";
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
  secuencial: string; // EJ: 000000123
}): string {
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
  
  const items = invoice.items as InvoiceItem[];

  const accessKey = buildSriAccessKey({
    issueDateISO: new Date(invoice.issueDate).toISOString().slice(0, 10),
    tipoComprobante: "01",
    ruc: issuer.ruc,
    ambiente,
    estab,
    ptoEmi,
    secuencial,
  });

  // ✅ Recalcular totales “desde cero” para consistencia
  const taxBuckets = new Map<number, { base: number; iva: number }>();
  let totalSinImpuestos = 0;
  let ivaTotal = 0;
  let importeTotal = 0;

  for (const it of items) {
    const qty = toNumber(it.quantity);
    const unit = toNumber(it.unitPrice);
    const rate = toNumber(it.ivaRate);
    const discount = toNumber(it.discount);

    const base = Math.max(qty * unit - discount, 0);
    const iva = base * (rate / 100);
    const lineTotal = base + iva;

    totalSinImpuestos += base;
    ivaTotal += iva;
    importeTotal += lineTotal;

    const bucket = taxBuckets.get(rate) ?? { base: 0, iva: 0 };
    bucket.base += base;
    bucket.iva += iva;
    taxBuckets.set(rate, bucket);
  }

  const detallesXml = items
    .map((item, idx) => {
      const qty = toNumber(item.quantity);
      const unit = toNumber(item.unitPrice);
      const rate = toNumber(item.ivaRate);
      const discount = toNumber(item.discount);

      const base = Math.max(qty * unit - discount, 0);
      const ivaValue = base * (rate / 100);

      return `
      <detalle>
        <codigoPrincipal>${escapeXml(item.productCode ?? `ITEM-${idx + 1}`)}</codigoPrincipal>
        <descripcion>${escapeXml(item.description)}</descripcion>
        <cantidad>${qty}</cantidad>
        <precioUnitario>${formatMoney(unit)}</precioUnitario>
        <descuento>${formatMoney(discount)}</descuento>
        <precioTotalSinImpuesto>${formatMoney(base)}</precioTotalSinImpuesto>
        <impuestos>
          <impuesto>
            <codigo>2</codigo>
            <codigoPorcentaje>${ivaRateToCodigoPorcentaje(rate)}</codigoPorcentaje>
            <tarifa>${rate}</tarifa>
            <baseImponible>${formatMoney(base)}</baseImponible>
            <valor>${formatMoney(ivaValue)}</valor>
          </impuesto>
        </impuestos>
      </detalle>`;
    })
    .join("");

    // ✅ totalConImpuestos: un <totalImpuesto> por tarifa (0,12,15…)
  const totalConImpuestosXml = Array.from(taxBuckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, v]) => {
      const codigoPorcentaje = ivaRateToCodigoPorcentaje(rate);
      return `
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${codigoPorcentaje}</codigoPorcentaje>
        <baseImponible>${formatMoney(v.base)}</baseImponible>
        <valor>${formatMoney(v.iva)}</valor>
      </totalImpuesto>`;
    })
    .join("");

  const tipoIdentificacionComprador = buildBuyerIdentificationType(client);

  return `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${escapeXml(issuer.name)}</razonSocial>
    <nombreComercial>${escapeXml(issuer.name)}</nombreComercial>
    <ruc>${escapeXml(issuer.ruc)}</ruc>
    <claveAcceso>${escapeXml(accessKey)}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${escapeXml(estab)}</estab>
    <ptoEmi>${escapeXml(ptoEmi)}</ptoEmi>
    <secuencial>${escapeXml(secuencial)}</secuencial>
    <dirMatriz>${escapeXml(issuerAddress)}</dirMatriz>
  </infoTributaria>

  <infoFactura>
    <fechaEmision>${formatDateDDMMYYYY(invoice.issueDate)}</fechaEmision>
    <dirEstablecimiento>${escapeXml(issuerAddress)}</dirEstablecimiento>
    <obligadoContabilidad>SI</obligadoContabilidad>

    <tipoIdentificacionComprador>${tipoIdentificacionComprador}</tipoIdentificacionComprador>
    <razonSocialComprador>${escapeXml(client.name)}</razonSocialComprador>
    <identificacionComprador>${escapeXml(client.identification)}</identificacionComprador>

    <totalSinImpuestos>${formatMoney(totalSinImpuestos)}</totalSinImpuestos>
    <totalDescuento>0.00</totalDescuento>

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
</factura>`.trim();
}