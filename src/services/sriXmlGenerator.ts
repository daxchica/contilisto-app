// src/services/sriXmlGenerator.ts
// SRI "factura" XML (DTE v2.x style) generator for Contilisto

import type { Invoice } from "@/types/Invoice";
import type { InvoiceItem } from "@/types/InvoiceItem";
import type { Client } from "@/services/clientService";
import type { Entity } from "@/types/Entity";

/**
 * Extra SRI-specific settings that usually don't live in Invoice / Entity
 * but are required for the XML header.
 */
export interface SriHeaderConfig {
  ambiente: "1" | "2";          // 1 = pruebas, 2 = producción
  tipoEmision: "1";             // 1 = normal (único modo soportado aquí)
  codDoc: "01";                 // 01 = factura (por ahora solo factura)
  estab: string;                // 3 dígitos, ej: "001"
  ptoEmi: string;               // 3 dígitos, ej: "001"
  secuencial: string;           // 9 dígitos, ej: "000000123"
  claveAcceso: string;          // Clave de acceso YA calculada
  dirMatriz: string;
  dirEstablecimiento?: string;
  obligadoContabilidad?: "SI" | "NO";
  moneda?: string;              // ej: "DOLAR"
}

/**
 * Información adicional que quieras enviar como <infoAdicional>.
 * key → atributo "nombre", value → texto del campo.
 */
export type SriAdditionalInfo = Record<string, string | undefined>;

/**
 * Parámetros principales para construir el XML.
 */
export interface SriInvoiceInput {
  invoice: Invoice;
  company: Entity;
  client: Client;
  items: InvoiceItem[];
  headerConfig: SriHeaderConfig;
  additionalInfo?: SriAdditionalInfo;
}

/* ============================================================
 * Small helpers
 * ============================================================ */

function formatMoney(value: number): string {
  // always 2 decimal places, with dot as separator
  return value.toFixed(2);
}

function formatDate_ddmmyyyy(timestamp: number): string {
  const d = new Date(timestamp);
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  const month = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

// Very small HTML/XML escape helper
function xmlEscape(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Map IVA percentage → SRI codigoPorcentaje.
 * This is simplified. Adjust if you later support more rates.
 */
function mapIvaRateToSriCode(ivaRate: number): string {
  switch (ivaRate) {
    case 0:
      return "0"; // 0% IVA
    case 12:
      return "2"; // 12% IVA (típico Ecuador)
    case 15:
      return "3"; // ejemplo para 15% si lo activas
    default:
      return "2";
  }
}

/* ============================================================
 * Core XML builder
 * ============================================================ */

export function buildSriInvoiceXml(input: SriInvoiceInput): string {
  const { invoice, company, client, items, headerConfig, additionalInfo } =
    input;

  // --- Totals per rate ---
  let totalDiscount = 0;
  let totalSinImpuestos = 0;

  const totalsByRate = new Map<
    number,
    { baseImponible: number; valorIva: number }
  >();

  items.forEach((item) => {
    const discount = item.discount ?? 0;
    const base = item.quantity * item.unitPrice - discount;
    const ivaRate = item.ivaRate ?? 0;
    const ivaValue = base * (ivaRate / 100);

    totalDiscount += discount;
    totalSinImpuestos += base;

    const existing = totalsByRate.get(ivaRate) ?? {
      baseImponible: 0,
      valorIva: 0,
    };
    existing.baseImponible += base;
    existing.valorIva += ivaValue;
    totalsByRate.set(ivaRate, existing);
  });

  const totalIva = Array.from(totalsByRate.values()).reduce(
    (sum, r) => sum + r.valorIva,
    0
  );
  const importeTotal = totalSinImpuestos + totalIva;

  const fechaEmision = formatDate_ddmmyyyy(new Date(invoice.issueDate).getTime());
  const moneda = headerConfig.moneda ?? "DOLAR";
  const obligadoContab = headerConfig.obligadoContabilidad ?? "SI";

  const razonSocial = company.name ?? "";
  const nombreComercial = company.name ?? "";
  const ruc = company.ruc ?? "";

  // Tipo identificación comprador (SRI codes)
  // 04 = RUC, 05 = cédula, 06 = pasaporte
  let tipoIdentificacionComprador: "04" | "05" | "06" = "04";
  if (client.tipo_identificacion === "cedula") tipoIdentificacionComprador = "05";
  if (client.tipo_identificacion === "pasaporte")
    tipoIdentificacionComprador = "06";

  const razonSocialComprador = client.razon_social;
  const identificacionComprador = client.identificacion;

  /* ============================================================
   * Build <totalConImpuestos>
   * ============================================================ */
  const totalConImpuestosXml = Array.from(totalsByRate.entries())
    .map(([rate, data]) => {
      const codigoPorcentaje = mapIvaRateToSriCode(rate);
      const tarifa = rate;

      return `
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${codigoPorcentaje}</codigoPorcentaje>
        <baseImponible>${formatMoney(data.baseImponible)}</baseImponible>
        <valor>${formatMoney(data.valorIva)}</valor>
        <tarifa>${formatMoney(tarifa)}</tarifa>
      </totalImpuesto>`.trim();
    })
    .join("");

  /* ============================================================
   * Build <detalles>
   * ============================================================ */
  const detallesXml = items
    .map((item) => {
      const discount = item.discount ?? 0;
      const base = item.quantity * item.unitPrice - discount;
      const ivaRate = item.ivaRate ?? 0;
      const ivaValue = base * (ivaRate / 100);
      const codigoPorcentaje = mapIvaRateToSriCode(ivaRate);

      const codigoPrincipal = item.productCode ?? item.sriCode ?? "001";
      const codigoAuxiliar = item.sriCode ?? undefined;

      const impuestosXml = `
        <impuestos>
          <impuesto>
            <codigo>2</codigo>
            <codigoPorcentaje>${codigoPorcentaje}</codigoPorcentaje>
            <tarifa>${formatMoney(ivaRate)}</tarifa>
            <baseImponible>${formatMoney(base)}</baseImponible>
            <valor>${formatMoney(ivaValue)}</valor>
          </impuesto>
        </impuestos>`.trim();

      return `
      <detalle>
        <codigoPrincipal>${xmlEscape(codigoPrincipal)}</codigoPrincipal>
        ${
          codigoAuxiliar
            ? `<codigoAuxiliar>${xmlEscape(codigoAuxiliar)}</codigoAuxiliar>`
            : ""
        }
        <descripcion>${xmlEscape(item.description)}</descripcion>
        <cantidad>${item.quantity}</cantidad>
        <precioUnitario>${formatMoney(item.unitPrice)}</precioUnitario>
        <descuento>${formatMoney(discount)}</descuento>
        <precioTotalSinImpuesto>${formatMoney(base)}</precioTotalSinImpuesto>
        ${impuestosXml}
      </detalle>`.trim();
    })
    .join("");

  /* ============================================================
   * Build <infoAdicional>
   * ============================================================ */
  let infoAdicionalXml = "";
  if (additionalInfo && Object.keys(additionalInfo).length > 0) {
    const campos = Object.entries(additionalInfo)
      .filter(([, value]) => value != null && value !== "")
      .map(
        ([key, value]) =>
          `<campoAdicional nombre="${xmlEscape(key)}">${xmlEscape(
            String(value)
          )}</campoAdicional>`
      )
      .join("");

    if (campos) {
      infoAdicionalXml = `
  <infoAdicional>
    ${campos}
  </infoAdicional>`.trim();
    }
  }

  /* ============================================================
   * Final XML
   * ============================================================ */

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="2.1.0">
  <infoTributaria>
    <ambiente>${headerConfig.ambiente}</ambiente>
    <tipoEmision>${headerConfig.tipoEmision}</tipoEmision>
    <razonSocial>${xmlEscape(razonSocial)}</razonSocial>
    <nombreComercial>${xmlEscape(nombreComercial)}</nombreComercial>
    <ruc>${xmlEscape(ruc)}</ruc>
    <claveAcceso>${headerConfig.claveAcceso}</claveAcceso>
    <codDoc>${headerConfig.codDoc}</codDoc>
    <estab>${headerConfig.estab}</estab>
    <ptoEmi>${headerConfig.ptoEmi}</ptoEmi>
    <secuencial>${headerConfig.secuencial}</secuencial>
    <dirMatriz>${xmlEscape(headerConfig.dirMatriz)}</dirMatriz>
  </infoTributaria>

  <infoFactura>
    <fechaEmision>${fechaEmision}</fechaEmision>
    <dirEstablecimiento>${xmlEscape(
      headerConfig.dirEstablecimiento ?? headerConfig.dirMatriz
    )}</dirEstablecimiento>
    <obligadoContabilidad>${obligadoContab}</obligadoContabilidad>
    <tipoIdentificacionComprador>${tipoIdentificacionComprador}</tipoIdentificacionComprador>
    <razonSocialComprador>${xmlEscape(
      razonSocialComprador
    )}</razonSocialComprador>
    <identificacionComprador>${xmlEscape(
      identificacionComprador
    )}</identificacionComprador>
    <totalSinImpuestos>${formatMoney(totalSinImpuestos)}</totalSinImpuestos>
    <totalDescuento>${formatMoney(totalDiscount)}</totalDescuento>
    <totalConImpuestos>
      ${totalConImpuestosXml}
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${formatMoney(importeTotal)}</importeTotal>
    <moneda>${xmlEscape(moneda)}</moneda>
  </infoFactura>

  <detalles>
    ${detallesXml}
  </detalles>
  ${infoAdicionalXml}
</factura>`;

  return xml;
}