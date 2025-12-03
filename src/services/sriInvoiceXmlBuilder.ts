// src/services/sriInvoiceXmlBuilder.ts

// Helper to avoid accidental "any"
export type EnvironmentCode = "1" | "2"; // 1 = test, 2 = production (SRI)
export type EmissionTypeCode = "1";      // 1 = normal emission

// ----------------------
// Seller (Issuer) data
// ----------------------
export interface SriIssuer {
  ruc: string;
  businessName: string;           // razonSocial
  tradeName?: string;             // nombreComercial (optional)
  mainAddress: string;            // dirMatriz
  establishmentAddress: string;   // dirEstablecimiento
  estab: string;                  // 3-digit establishment code, e.g. "001"
  ptoEmi: string;                 // 3-digit emission point code, e.g. "001"
  obligadoContabilidad?: "SI" | "NO";
  ambiente: EnvironmentCode;      // "1" test, "2" production
  tipoEmision: EmissionTypeCode;  // "1"
}

// ----------------------
// Buyer (Client) data
// ----------------------
export interface SriBuyer {
  identificationType: string;     // tipoIdentificacionComprador (e.g. "05" = cédula, "04" = RUC)
  identification: string;         // identificacionComprador
  name: string;                   // razonSocialComprador
  address?: string;               // direccionComprador
  email?: string;
  phone?: string;
}

// ----------------------
// Invoice line & taxes
// ----------------------
export interface SriInvoiceTax {
  code: string;              // <codigo>  e.g. "2" = IVA
  percentageCode: string;    // <codigoPorcentaje> e.g. "2" = 12% IVA, "0" = 0%
  rate: number;              // <tarifa> e.g. 12.00
  taxableBase: number;       // <baseImponible>
  value: number;             // <valor>
}

export interface SriInvoiceLine {
  mainCode: string;          // <codigoPrincipal>
  description: string;       // <descripcion>
  quantity: number;          // <cantidad>
  unitPrice: number;         // <precioUnitario>
  discount: number;          // <descuento>
  lineTotalWithoutTax: number; // <precioTotalSinImpuesto>
  taxes: SriInvoiceTax[];    // <impuestos><impuesto>...</impuesto></impuestos>
}

// ----------------------
// Payment info
// ----------------------
export interface SriPayment {
  method: string;       // <formaPago>  (SRI Table 24, e.g. "01" = efectivo)
  total: number;        // <total>
  term?: number;        // <plazo>
  timeUnit?: string;    // <unidadTiempo> (e.g. "dias")
}

// ----------------------
// High-level invoice input
// ----------------------
export interface SriInvoiceInput {
  // Access key and sequence are assumed to be generated elsewhere
  accessKey: string;       // <claveAcceso> (49 characters)
  sequence: string;        // <secuencial> (9 digits, zero-padded, e.g. "000000123")

  issueDate: string;       // <fechaEmision> "dd/MM/yyyy"
  currency?: string;       // <moneda> default "DOLAR"

  issuer: SriIssuer;
  buyer: SriBuyer;

  // Totals
  totalWithoutTaxes: number;          // <totalSinImpuestos>
  totalDiscount: number;              // <totalDescuento>
  totalWithTaxes: SriInvoiceTax[];    // <totalConImpuestos><totalImpuesto>...</totalImpuesto>
  tip?: number;                       // <propina>
  grandTotal: number;                 // <importeTotal>

  payments: SriPayment[];

  // Lines
  lines: SriInvoiceLine[];

  // Optional extra info (goes into <infoAdicional>)
  additionalFields?: Array<{
    name: string;
    value: string;
  }>;
}

/* -------------------------------------------------------
 * Utility: basic XML escaping
 * ----------------------------------------------------- */
function escapeXml(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* -------------------------------------------------------
 * Utility: two decimal formatting (SRI uses 2–6 decimals,
 * we'll start with 2 for simplicity)
 * ----------------------------------------------------- */
function money(value: number): string {
  return value.toFixed(2);
}

/* -------------------------------------------------------
 * MAIN BUILDER
 * Generates SRI XML string for FACTURA (v1.1.0)
 * ----------------------------------------------------- */
export function buildSriInvoiceXml(input: SriInvoiceInput): string {
  const {
    accessKey,
    sequence,
    issueDate,
    currency = "DOLAR",
    issuer,
    buyer,
    totalWithoutTaxes,
    totalDiscount,
    totalWithTaxes,
    tip = 0,
    grandTotal,
    payments,
    lines,
    additionalFields,
  } = input;

  // -------- infoTributaria --------
  const infoTributaria = `
    <infoTributaria>
      <ambiente>${issuer.ambiente}</ambiente>
      <tipoEmision>${issuer.tipoEmision}</tipoEmision>
      <razonSocial>${escapeXml(issuer.businessName)}</razonSocial>
      ${
        issuer.tradeName
          ? `<nombreComercial>${escapeXml(issuer.tradeName)}</nombreComercial>`
          : ""
      }
      <ruc>${escapeXml(issuer.ruc)}</ruc>
      <claveAcceso>${escapeXml(accessKey)}</claveAcceso>
      <codDoc>01</codDoc>
      <estab>${escapeXml(issuer.estab)}</estab>
      <ptoEmi>${escapeXml(issuer.ptoEmi)}</ptoEmi>
      <secuencial>${escapeXml(sequence)}</secuencial>
      <dirMatriz>${escapeXml(issuer.mainAddress)}</dirMatriz>
    </infoTributaria>
  `.trim();

  // -------- totalConImpuestos --------
  const totalConImpuestosXml =
    totalWithTaxes.length === 0
      ? ""
      : `
    <totalConImpuestos>
      ${totalWithTaxes
        .map(
          (t) => `
        <totalImpuesto>
          <codigo>${escapeXml(t.code)}</codigo>
          <codigoPorcentaje>${escapeXml(t.percentageCode)}</codigoPorcentaje>
          <baseImponible>${money(t.taxableBase)}</baseImponible>
          <valor>${money(t.value)}</valor>
        </totalImpuesto>`
        )
        .join("")}
    </totalConImpuestos>
  `.trim();

  // -------- pagos --------
  const pagosXml =
    payments.length === 0
      ? ""
      : `
    <pagos>
      ${payments
        .map(
          (p) => `
        <pago>
          <formaPago>${escapeXml(p.method)}</formaPago>
          <total>${money(p.total)}</total>
          ${
            p.term !== undefined
              ? `<plazo>${escapeXml(p.term)}</plazo>`
              : ""
          }
          ${
            p.timeUnit
              ? `<unidadTiempo>${escapeXml(p.timeUnit)}</unidadTiempo>`
              : ""
          }
        </pago>`
        )
        .join("")}
    </pagos>
  `.trim();

  // -------- infoFactura --------
  const infoFactura = `
    <infoFactura>
      <fechaEmision>${escapeXml(issueDate)}</fechaEmision>
      <dirEstablecimiento>${escapeXml(
        issuer.establishmentAddress
      )}</dirEstablecimiento>
      ${
        issuer.obligadoContabilidad
          ? `<obligadoContabilidad>${issuer.obligadoContabilidad}</obligadoContabilidad>`
          : ""
      }
      <tipoIdentificacionComprador>${escapeXml(
        buyer.identificationType
      )}</tipoIdentificacionComprador>
      <razonSocialComprador>${escapeXml(buyer.name)}</razonSocialComprador>
      <identificacionComprador>${escapeXml(
        buyer.identification
      )}</identificacionComprador>
      ${
        buyer.address
          ? `<direccionComprador>${escapeXml(
              buyer.address
            )}</direccionComprador>`
          : ""
      }
      <totalSinImpuestos>${money(totalWithoutTaxes)}</totalSinImpuestos>
      <totalDescuento>${money(totalDiscount)}</totalDescuento>
      ${totalConImpuestosXml}
      <propina>${money(tip)}</propina>
      <importeTotal>${money(grandTotal)}</importeTotal>
      <moneda>${escapeXml(currency)}</moneda>
      ${pagosXml}
    </infoFactura>
  `.trim();

  // -------- detalles (lines) --------
  const detallesXml = `
    <detalles>
      ${lines
        .map((line) => {
          const impuestosXml =
            line.taxes.length === 0
              ? ""
              : `
          <impuestos>
            ${line.taxes
              .map(
                (t) => `
              <impuesto>
                <codigo>${escapeXml(t.code)}</codigo>
                <codigoPorcentaje>${escapeXml(
                  t.percentageCode
                )}</codigoPorcentaje>
                <tarifa>${money(t.rate)}</tarifa>
                <baseImponible>${money(t.taxableBase)}</baseImponible>
                <valor>${money(t.value)}</valor>
              </impuesto>`
              )
              .join("")}
          </impuestos>`.trim();

          return `
        <detalle>
          <codigoPrincipal>${escapeXml(line.mainCode)}</codigoPrincipal>
          <descripcion>${escapeXml(line.description)}</descripcion>
          <cantidad>${line.quantity.toFixed(2)}</cantidad>
          <precioUnitario>${money(line.unitPrice)}</precioUnitario>
          <descuento>${money(line.discount)}</descuento>
          <precioTotalSinImpuesto>${money(
            line.lineTotalWithoutTax
          )}</precioTotalSinImpuesto>
          ${impuestosXml}
        </detalle>`;
        })
        .join("")}
    </detalles>
  `.trim();

  // -------- infoAdicional --------
  const infoAdicionalXml =
    (additionalFields && additionalFields.length > 0) ||
    buyer.email ||
    buyer.phone
      ? `
    <infoAdicional>
      ${
        buyer.email
          ? `<campoAdicional nombre="email">${escapeXml(
              buyer.email
            )}</campoAdicional>`
          : ""
      }
      ${
        buyer.phone
          ? `<campoAdicional nombre="telefono">${escapeXml(
              buyer.phone
            )}</campoAdicional>`
          : ""
      }
      ${(
        additionalFields ?? []
      )
        .map(
          (f) =>
            `<campoAdicional nombre="${escapeXml(
              f.name
            )}">${escapeXml(f.value)}</campoAdicional>`
        )
        .join("")}
    </infoAdicional>
  `.trim()
      : "";

  // -------- FULL XML --------
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  ${infoTributaria}
  ${infoFactura}
  ${detallesXml}
  ${infoAdicionalXml}
</factura>`.trim();

  return xml;
}