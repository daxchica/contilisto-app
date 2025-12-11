// ============================================================================
// xmlBuilder.ts (FACTURA electrónica SRI – DTE v1.1.0)
// Genera XML válido + clave de acceso + totales automáticos.
//
// Totalmente compatible con signXML.ts, keyLoader.ts y sendToSRI.ts
// ============================================================================

export type SriEnvironment = "1" | "2"; // 1 = pruebas, 2 = producción
export type SriEmissionType = "1";      // siempre 1
export type SriIdType = "04" | "05" | "06" | "07"; 

// -----------------------------------------------------------------------------
// Información del emisor
// -----------------------------------------------------------------------------
export interface SriEmitterInfo {
  ruc: string;
  businessName: string;
  tradeName?: string;
  mainAddress: string;
  establishmentAddress?: string;
  estabCode: string;           // 001
  emissionPointCode: string;   // 001
  specialContributorNumber?: string;
  accountingRequired?: boolean; // SI / NO
}

// -----------------------------------------------------------------------------
// Información del comprador
// -----------------------------------------------------------------------------
export interface SriClientInfo {
  idType: SriIdType;
  idNumber: string;
  name: string;
  address?: string;
  email?: string;
  phone?: string;
}

// -----------------------------------------------------------------------------
// Ítems de la factura
// -----------------------------------------------------------------------------
export interface InvoiceItem {
  code?: string;        // Código interno
  productCode?: string; // Código de producto
  sriCode?: string;     // Código principal SRI
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  ivaRate: 0 | 12 | 15; // soportado oficialmente
}

// -----------------------------------------------------------------------------
// Datos generales de factura a convertir a XML
// -----------------------------------------------------------------------------
export interface InvoiceForSri {
  internalId: string;
  issueDate: Date;
  currency?: string;
  items: InvoiceItem[];

  subtotal0?: number;
  subtotal12?: number;
  subtotal15?: number;
  iva12?: number;
  iva15?: number;
  total?: number;

  sequential: string;
  additionalInfo?: Record<string, string>;
}

// -----------------------------------------------------------------------------
// Parámetros para generar XML + claveAcceso
// -----------------------------------------------------------------------------
export interface SriInvoiceXmlParams {
  environment: SriEnvironment;
  emissionType?: SriEmissionType;
  documentType?: string;  // 01 = FACTURA
  numericCode?: string;   // 8 dígitos
  emitter: SriEmitterInfo;
  client: SriClientInfo;
  invoice: InvoiceForSri;
}

export interface SriInvoiceXmlResult {
  xml: string;
  accessKey: string;
}

// ============================================================================
// PUBLIC API
// ============================================================================

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

  // 1) Totales
  const totals = calculateTotals(invoice.items);

  const subtotal0 = invoice.subtotal0 ?? totals.subtotal0;
  const subtotal12 = invoice.subtotal12 ?? totals.subtotal12;
  const subtotal15 = invoice.subtotal15 ?? totals.subtotal15;
  const iva12 = invoice.iva12 ?? totals.iva12;
  const iva15 = invoice.iva15 ?? totals.iva15;

  const total =
    invoice.total ??
    subtotal0 + subtotal12 + subtotal15 + iva12 + iva15;

  // 2) Formato de fechas
  const dateForKey = formatDate(invoice.issueDate, "DDMMAAAA");
  const dateForXml = formatDate(invoice.issueDate, "DD/MM/AAAA");

  // 3) Serie estab + ptoEmi
  const serie =
    emitter.estabCode.padStart(3, "0") +
    emitter.emissionPointCode.padStart(3, "0");

  const sequential9 = invoice.sequential.padStart(9, "0");

  // 4) Clave de acceso (48 + dígito verificador)
  const baseKey =
    dateForKey +
    documentType +
    emitter.ruc.padStart(13, "0") +
    environment +
    serie +
    sequential9 +
    numericCode +
    emissionType;

  const checkDigit = calculateModulo11Digit(baseKey);
  const accessKey = baseKey + checkDigit;

  // 5) Construir XML
  const xml = buildFacturaXml({
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
    subtotal15,
    iva12,
    iva15,
    total,
  });

  return { xml, accessKey };
}

// ============================================================================
// HELPERS
// ============================================================================

function calculateTotals(items: InvoiceItem[]) {
  let subtotal0 = 0;
  let subtotal12 = 0;
  let subtotal15 = 0;

  for (const item of items) {
    const base = item.quantity * item.unitPrice - (item.discount ?? 0);

    if (item.ivaRate === 12) subtotal12 += base;
    else if (item.ivaRate === 15) subtotal15 += base;
    else subtotal0 += base;
  }

  subtotal0 = round2(subtotal0);
  subtotal12 = round2(subtotal12);
  subtotal15 = round2(subtotal15);

  const iva12 = round2(subtotal12 * 0.12);
  const iva15 = round2(subtotal15 * 0.15);

  return { subtotal0, subtotal12, subtotal15, iva12, iva15 };
}

function formatDate(date: Date, format: "DDMMAAAA" | "DD/MM/AAAA") {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();

  return format === "DDMMAAAA" ? `${d}${m}${y}` : `${d}/${m}/${y}`;
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function formatAmount(v: number) {
  return v.toFixed(2);
}

function generateNumericCode() {
  return Math.floor(Math.random() * 100000000)
    .toString()
    .padStart(8, "0");
}

// ---------------- Módulo 11 ----------------

function calculateModulo11Digit(base: string) {
  const weights = [2, 3, 4, 5, 6, 7];
  let sum = 0;
  let wi = 0;

  for (let i = base.length - 1; i >= 0; i--) {
    sum += parseInt(base[i], 10) * weights[wi];
    wi = wi === 5 ? 0 : wi + 1;
  }

  const mod = sum % 11;
  const check = 11 - mod;

  if (check === 11) return 0;
  if (check === 10) return 1;
  return check;
}

function xmlEscape(v: string | undefined | null) {
  if (!v) return "";
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============================================================================
// CORE BUILDER
// ============================================================================

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
  subtotal15: number;
  iva12: number;
  iva15: number;
  total: number;
}

function buildFacturaXml(p: BuildXmlParams): string {
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
    subtotal15,
    iva12,
    iva15,
    total,
  } = p;

  const totalSinImpuestos =
    round2(subtotal0 + subtotal12 + subtotal15);

  // --------- TOTALCONIMPUESTOS ----------
  const totalImpuestos: string[] = [];

  if (subtotal12 > 0)
    totalImpuestos.push(`
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>2</codigoPorcentaje>
        <baseImponible>${formatAmount(subtotal12)}</baseImponible>
        <valor>${formatAmount(iva12)}</valor>
        <tarifa>12.00</tarifa>
      </totalImpuesto>`);

  if (subtotal15 > 0)
    totalImpuestos.push(`
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>3</codigoPorcentaje>
        <baseImponible>${formatAmount(subtotal15)}</baseImponible>
        <valor>${formatAmount(iva15)}</valor>
        <tarifa>15.00</tarifa>
      </totalImpuesto>`);

  if (subtotal0 > 0)
    totalImpuestos.push(`
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>0</codigoPorcentaje>
        <baseImponible>${formatAmount(subtotal0)}</baseImponible>
        <valor>0.00</valor>
        <tarifa>0.00</tarifa>
      </totalImpuesto>`);

  // --------- DETALLES ----------
  const detallesXml = invoice.items
    .map((item) => {
      const discount = item.discount ?? 0;
      const base = round2(item.quantity * item.unitPrice - discount);
      const ivaRate = item.ivaRate;
      const ivaValue = round2(base * (ivaRate / 100));

      const codigoPrincipal =
        item.code ?? item.productCode ?? item.sriCode ?? "001";

      return `
      <detalle>
        <codigoPrincipal>${xmlEscape(codigoPrincipal)}</codigoPrincipal>
        <descripcion>${xmlEscape(item.description)}</descripcion>
        <cantidad>${formatAmount(item.quantity)}</cantidad>
        <precioUnitario>${formatAmount(item.unitPrice)}</precioUnitario>
        <descuento>${formatAmount(discount)}</descuento>
        <precioTotalSinImpuesto>${formatAmount(base)}</precioTotalSinImpuesto>
        <impuestos>
          <impuesto>
            <codigo>2</codigo>
            <codigoPorcentaje>${ivaRate === 12 ? "2" : ivaRate === 15 ? "3" : "0"}</codigoPorcentaje>
            <tarifa>${formatAmount(ivaRate)}</tarifa>
            <baseImponible>${formatAmount(base)}</baseImponible>
            <valor>${formatAmount(ivaValue)}</valor>
          </impuesto>
        </impuestos>
      </detalle>`;
    })
    .join("");

  // --------- INFO ADICIONAL ----------
  const infoAdicionalEntries: string[] = [];

  if (client.email)
    infoAdicionalEntries.push(
      `<campoAdicional nombre="email">${xmlEscape(client.email)}</campoAdicional>`
    );

  if (client.phone)
    infoAdicionalEntries.push(
      `<campoAdicional nombre="telefono">${xmlEscape(client.phone)}</campoAdicional>`
    );

  if (invoice.additionalInfo) {
    for (const [k, v] of Object.entries(invoice.additionalInfo)) {
      if (v)
        infoAdicionalEntries.push(
          `<campoAdicional nombre="${xmlEscape(k)}">${xmlEscape(v)}</campoAdicional>`
        );
    }
  }

  const infoAdicionalXml =
    infoAdicionalEntries.length > 0
      ? `<infoAdicional>${infoAdicionalEntries.join("")}</infoAdicional>`
      : "";

  // --------- XML FINAL ----------
  return `
<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${environment}</ambiente>
    <tipoEmision>${emissionType}</tipoEmision>
    <razonSocial>${xmlEscape(emitter.businessName)}</razonSocial>
    ${emitter.tradeName ? `<nombreComercial>${xmlEscape(emitter.tradeName)}</nombreComercial>` : ""}
    <ruc>${emitter.ruc}</ruc>
    <claveAcceso>${accessKey}</claveAcceso>
    <codDoc>${documentType}</codDoc>
    <estab>${emitter.estabCode}</estab>
    <ptoEmi>${emitter.emissionPointCode}</ptoEmi>
    <secuencial>${invoice.sequential}</secuencial>
    <dirMatriz>${xmlEscape(emitter.mainAddress)}</dirMatriz>
  </infoTributaria>

  <infoFactura>
    <fechaEmision>${dateForXml}</fechaEmision>
    ${emitter.establishmentAddress ? `<dirEstablecimiento>${xmlEscape(emitter.establishmentAddress)}</dirEstablecimiento>` : ""}
    ${emitter.specialContributorNumber ? `<contribuyenteEspecial>${xmlEscape(emitter.specialContributorNumber)}</contribuyenteEspecial>` : ""}
    <obligadoContabilidad>${emitter.accountingRequired ? "SI" : "NO"}</obligadoContabilidad>
    <tipoIdentificacionComprador>${client.idType}</tipoIdentificacionComprador>
    <razonSocialComprador>${xmlEscape(client.name)}</razonSocialComprador>
    <identificacionComprador>${xmlEscape(client.idNumber)}</identificacionComprador>
    <totalSinImpuestos>${formatAmount(totalSinImpuestos)}</totalSinImpuestos>
    <totalDescuento>0.00</totalDescuento>
    <totalConImpuestos>
      ${totalImpuestos.join("\n")}
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${formatAmount(total)}</importeTotal>
    <moneda>${xmlEscape(invoice.currency ?? "USD")}</moneda>
  </infoFactura>

  <detalles>
    ${detallesXml}
  </detalles>

  ${infoAdicionalXml}
</factura>
`.trim();
}