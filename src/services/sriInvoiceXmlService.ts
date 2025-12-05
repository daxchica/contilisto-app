// src/services/sriInvoiceXmlService.ts
// SRI Electronic Invoice XML (DTE v2 – versión 1.1.0)

export type SriEnvironment = "1" | "2"; // 1 = pruebas, 2 = producción
export type SriEmissionType = "1"; // 1 = normal (emisión en línea)

// Tipos de identificación del comprador (tabla SRI)
export type SriIdType = "04" | "05" | "06" | "07"; 
// 04 = RUC, 05 = Cédula, 06 = Pasaporte, 07 = Consumidor final, etc.

// Información mínima de la empresa emisora
export interface SriEmitterInfo {
  ruc: string;                 // RUC emisor (13 dígitos)
  businessName: string;        // Razón social
  tradeName?: string;          // Nombre comercial
  mainAddress: string;         // Dirección matriz (dirMatriz)
  establishmentAddress?: string; // Dirección del establecimiento (dirEstablecimiento)
  estabCode: string;           // Código establecimiento (3 dígitos, ej: "001")
  emissionPointCode: string;   // Punto de emisión (3 dígitos, ej: "001")
  specialContributorNumber?: string; // contribuyenteEspecial (opcional)
  accountingRequired?: boolean;      // obligadoContabilidad
}

// Info del cliente (comprador)
export interface SriClientInfo {
  idType: SriIdType;
  idNumber: string;
  name: string;
  address?: string;
  email?: string;
  phone?: string;
}

// Item de la factura
export interface InvoiceItem {
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number; // monto absoluto, no %
  ivaRate: 0 | 12;   // soportamos 0% y 12% (lo más común)
}

// Datos de la factura
export interface InvoiceForSri {
  // id interno de tu sistema (no va al XML)
  internalId: string;
  issueDate: Date;
  currency?: string; // ej: "USD"
  items: InvoiceItem[];

  // Totales opcionales: si no los pasas, se calculan
  subtotal0?: number;
  subtotal12?: number;
  iva12?: number;
  total?: number;

  // Secuencial SRI "000000123"
  sequential: string; // siempre 9 dígitos con padding
  additionalInfo?: Record<string, string>;
}

// Parámetros generales para armar el XML
export interface SriInvoiceXmlParams {
  environment: SriEnvironment;        // 1 prueba, 2 producción
  emissionType?: SriEmissionType;     // normalmente "1"
  documentType?: string;              // "01" = factura
  numericCode?: string;               // código numérico (8 dígitos). Si no, se genera.
  emitter: SriEmitterInfo;
  client: SriClientInfo;
  invoice: InvoiceForSri;
}

// Resultado
export interface SriInvoiceXmlResult {
  xml: string;
  accessKey: string;
}

/* =======================================================
   PUBLIC API
   ======================================================= */

export function generateSriInvoiceXmlV2(
  params: SriInvoiceXmlParams
): SriInvoiceXmlResult {
  const {
    environment,
    emissionType = "1",
    documentType = "01",
    numericCode = generateNumericCode(),
    emitter,
    client,
    invoice,
  } = params;

  // 1) Totales por IVA
  const totals = calculateTotals(invoice.items);

  const subtotal0 = invoice.subtotal0 ?? totals.subtotal0;
  const subtotal12 = invoice.subtotal12 ?? totals.subtotal12;
  const iva12 = invoice.iva12 ?? totals.iva12;
  const total = invoice.total ?? (subtotal0 + subtotal12 + iva12);

  // 2) Fecha: DDMMAAAA para claveAcceso y DD/MM/AAAA para XML
  const issueDate = invoice.issueDate;
  const dateForKey = formatDate(issueDate, "DDMMAAAA");
  const dateForXml = formatDate(issueDate, "DD/MM/AAAA");

  // 3) Serie = estab + puntoEmision
  const serie = emitter.estabCode.padStart(3, "0") +
                emitter.emissionPointCode.padStart(3, "0");

  const sequential9 = invoice.sequential.padStart(9, "0");

  // 4) Clave de acceso (48 dígitos + dígito verificador = 49)
  const baseKey =
    dateForKey +
    documentType +
    emitter.ruc.padStart(13, "0") +
    environment +
    serie +
    sequential9 +
    numericCode.padStart(8, "0") +
    emissionType;

  const checkDigit = calculateModulo11Digit(baseKey);
  const accessKey = baseKey + checkDigit.toString();

  // 5) Generar XML
  const xml = buildInvoiceXml({
    accessKey,
    documentType,
    environment,
    emissionType,
    emitter,
    client,
    invoice,
    dateForXml,
    subtotal0,
    subtotal12,
    iva12,
    total,
  });

  return { xml, accessKey };
}

/* =======================================================
   INTERNAL HELPERS
   ======================================================= */

function calculateTotals(items: InvoiceItem[]) {
  let subtotal0 = 0;
  let subtotal12 = 0;

  for (const item of items) {
    const qty = item.quantity;
    const unitPrice = item.unitPrice;
    const discount = item.discount ?? 0;

    const lineBase = qty * unitPrice - discount;

    if (item.ivaRate === 12) {
      subtotal12 += lineBase;
    } else {
      subtotal0 += lineBase;
    }
  }

  subtotal0 = round2(subtotal0);
  subtotal12 = round2(subtotal12);
  const iva12 = round2(subtotal12 * 0.12);

  return { subtotal0, subtotal12, iva12 };
}

function formatDate(date: Date, format: "DDMMAAAA" | "DD/MM/AAAA"): string {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear().toString();

  if (format === "DDMMAAAA") return `${d}${m}${y}`;
  return `${d}/${m}/${y}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatAmount(value: number): string {
  return value.toFixed(2);
}

// Genera un código numérico pseudoaleatorio de 8 dígitos
function generateNumericCode(): string {
  const n = Math.floor(Math.random() * 100000000);
  return n.toString().padStart(8, "0");
}

/**
 * Calcula el dígito verificador para la clave de acceso (Módulo 11).
 * Se aplica sobre los 48 dígitos base, con factores de 2 a 7 repetidos.  [oai_citation:1‡Datil](https://datil.dev/?utm_source=chatgpt.com)
 */
function calculateModulo11Digit(baseKey48: string): number {
  if (baseKey48.length !== 48) {
    throw new Error("Access key base must have 48 digits");
  }

  const weights = [2, 3, 4, 5, 6, 7];
  let weightIndex = 0;
  let sum = 0;

  // Se procesa de derecha a izquierda
  for (let i = baseKey48.length - 1; i >= 0; i--) {
    const digit = parseInt(baseKey48.charAt(i), 10);
    const weight = weights[weightIndex];
    sum += digit * weight;

    weightIndex++;
    if (weightIndex >= weights.length) {
      weightIndex = 0;
    }
  }

  const mod = sum % 11;
  let check = 11 - mod;

  if (check === 11) check = 0;
  else if (check === 10) check = 1;

  return check;
}

function escapeXml(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* =======================================================
   XML BUILDER
   ======================================================= */

interface BuildXmlParams {
  accessKey: string;
  documentType: string;
  environment: SriEnvironment;
  emissionType: SriEmissionType;
  emitter: SriEmitterInfo;
  client: SriClientInfo;
  invoice: InvoiceForSri;
  dateForXml: string;
  subtotal0: number;
  subtotal12: number;
  iva12: number;
  total: number;
}

function buildInvoiceXml(p: BuildXmlParams): string {
  const {
    accessKey,
    documentType,
    environment,
    emissionType,
    emitter,
    client,
    invoice,
    dateForXml,
    subtotal0,
    subtotal12,
    iva12,
    total,
  } = p;

  const serie =
    emitter.estabCode.padStart(3, "0") +
    emitter.emissionPointCode.padStart(3, "0");

  const totalSinImpuestos = round2(subtotal0 + subtotal12);

  // Totales por IVA en infoFactura/totalConImpuestos
  const totalImpuestos: string[] = [];

  if (subtotal12 > 0) {
    totalImpuestos.push(`
        <totalImpuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>2</codigoPorcentaje>
          <baseImponible>${formatAmount(subtotal12)}</baseImponible>
          <valor>${formatAmount(iva12)}</valor>
        </totalImpuesto>`.trim());
  }

  if (subtotal0 > 0) {
    totalImpuestos.push(`
        <totalImpuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>0</codigoPorcentaje>
          <baseImponible>${formatAmount(subtotal0)}</baseImponible>
          <valor>0.00</valor>
        </totalImpuesto>`.trim());
  }

  // Detalles (items)
  const detallesXml = invoice.items
    .map((item) => {
      const qty = item.quantity;
      const unitPrice = item.unitPrice;
      const discount = item.discount ?? 0;
      const base = round2(qty * unitPrice - discount);

      let codigoPorcentaje = "0";
      let tarifa = 0;
      let valorIva = 0;

      if (item.ivaRate === 12) {
        codigoPorcentaje = "2";
        tarifa = 12;
        valorIva = round2(base * 0.12);
      }

      const impuestos = `
        <impuestos>
          <impuesto>
            <codigo>2</codigo>
            <codigoPorcentaje>${codigoPorcentaje}</codigoPorcentaje>
            <tarifa>${formatAmount(tarifa)}</tarifa>
            <baseImponible>${formatAmount(base)}</baseImponible>
            <valor>${formatAmount(valorIva)}</valor>
          </impuesto>
        </impuestos>`.trim();

      return `
      <detalle>
        <codigoPrincipal>${escapeXml(item.code)}</codigoPrincipal>
        <descripcion>${escapeXml(item.description)}</descripcion>
        <cantidad>${formatAmount(qty)}</cantidad>
        <precioUnitario>${formatAmount(unitPrice)}</precioUnitario>
        <descuento>${formatAmount(discount)}</descuento>
        <precioTotalSinImpuesto>${formatAmount(base)}</precioTotalSinImpuesto>
        ${impuestos}
      </detalle>`.trim();
    })
    .join("\n");

  // infoAdicional (correo, teléfono y adicionales)
  const infoAdicionalEntries: string[] = [];

  if (client.email) {
    infoAdicionalEntries.push(`
      <campoAdicional nombre="Email">${escapeXml(client.email)}</campoAdicional>`.trim());
  }

  if (client.phone) {
    infoAdicionalEntries.push(`
      <campoAdicional nombre="Teléfono">${escapeXml(client.phone)}</campoAdicional>`.trim());
  }

  if (invoice.additionalInfo) {
    for (const [key, value] of Object.entries(invoice.additionalInfo)) {
      infoAdicionalEntries.push(`
      <campoAdicional nombre="${escapeXml(key)}">${escapeXml(
        value
      )}</campoAdicional>`.trim());
    }
  }

  const infoAdicionalXml =
    infoAdicionalEntries.length > 0
      ? `
  <infoAdicional>
    ${infoAdicionalEntries.join("\n    ")}
  </infoAdicional>`
      : "";

  // XML final (versión 1.1.0, DTE v2)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${environment}</ambiente>
    <tipoEmision>${emissionType}</tipoEmision>
    <razonSocial>${escapeXml(emitter.businessName)}</razonSocial>
    ${
      emitter.tradeName
        ? `<nombreComercial>${escapeXml(emitter.tradeName)}</nombreComercial>`
        : ""
    }
    <ruc>${emitter.ruc}</ruc>
    <claveAcceso>${accessKey}</claveAcceso>
    <codDoc>${documentType}</codDoc>
    <estab>${emitter.estabCode.padStart(3, "0")}</estab>
    <ptoEmi>${emitter.emissionPointCode.padStart(3, "0")}</ptoEmi>
    <secuencial>${invoice.sequential.padStart(9, "0")}</secuencial>
    <dirMatriz>${escapeXml(emitter.mainAddress)}</dirMatriz>
  </infoTributaria>

  <infoFactura>
    <fechaEmision>${dateForXml}</fechaEmision>
    ${
      emitter.establishmentAddress
        ? `<dirEstablecimiento>${escapeXml(
            emitter.establishmentAddress
          )}</dirEstablecimiento>`
        : ""
    }
    ${
      emitter.specialContributorNumber
        ? `<contribuyenteEspecial>${
            emitter.specialContributorNumber
          }</contribuyenteEspecial>`
        : ""
    }
    ${
      typeof emitter.accountingRequired === "boolean"
        ? `<obligadoContabilidad>${
            emitter.accountingRequired ? "SI" : "NO"
          }</obligadoContabilidad>`
        : ""
    }
    <tipoIdentificacionComprador>${client.idType}</tipoIdentificacionComprador>
    <razonSocialComprador>${escapeXml(client.name)}</razonSocialComprador>
    <identificacionComprador>${escapeXml(
      client.idNumber
    )}</identificacionComprador>
    <totalSinImpuestos>${formatAmount(
      totalSinImpuestos
    )}</totalSinImpuestos>
    <totalDescuento>0.00</totalDescuento>
    <totalConImpuestos>
      ${totalImpuestos.join("\n      ")}
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${formatAmount(total)}</importeTotal>
    <moneda>${escapeXml(invoice.currency ?? "USD")}</moneda>
  </infoFactura>

  <detalles>
    ${detallesXml}
  </detalles>
  ${infoAdicionalXml}
</factura>`;

  return xml.trim();
}