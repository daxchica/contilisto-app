import { generateAccessKey } from "../../../src/utils/sri/generateAccessKey";

/**
 * Generates SRI-compliant XML (Factura v1.1.0) + claveAcceso
 * This function is PURE and deterministic.
 */
export function generateSriInvoiceXml(input: {
  environment: "1" | "2";
  invoice: {
    issueDate: string;
    sri: {
      estab: string;
      ptoEmi: string;
      secuencial: string;
    };
    customer: {
      identificationType: string;
      identification: string;
      name: string;
      address?: string;
      email?: string;
    };
    totals: {
      subtotalSinImpuestos: number;
      ivaByRate: Record<number, number>;
      total: number;
    };
  };
  entity: {
    ruc: string;
    razonSocial: string;
    nombreComercial?: string;
    dirMatriz?: string;
  };
}): { xml: string; accessKey: string } {
  const { invoice, entity, environment } = input;

  if (!invoice.issueDate) {
    throw new Error("invoice.issueDate requerido");
  }

  const date = invoice.issueDate.replace(/-/g, "");
  const docType = "01"; // FACTURA

  const accessKey = generateAccessKey({
    date,
    docType,
    ruc: entity.ruc,
    ambiente: environment,
    estab: invoice.sri.estab,
    ptoEmi: invoice.sri.ptoEmi,
    secuencial: invoice.sri.secuencial,
  });

  const xml = `
<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${environment}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${entity.razonSocial}</razonSocial>
    <nombreComercial>${entity.nombreComercial ?? entity.razonSocial}</nombreComercial>
    <ruc>${entity.ruc}</ruc>
    <claveAcceso>${accessKey}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${invoice.sri.estab}</estab>
    <ptoEmi>${invoice.sri.ptoEmi}</ptoEmi>
    <secuencial>${invoice.sri.secuencial}</secuencial>
    <dirMatriz>${entity.dirMatriz ?? "N/A"}</dirMatriz>
  </infoTributaria>

  <infoFactura>
    <fechaEmision>${invoice.issueDate}</fechaEmision>
    <tipoIdentificacionComprador>${mapIdType(invoice.customer.identificationType)}</tipoIdentificacionComprador>
    <razonSocialComprador>${invoice.customer.name}</razonSocialComprador>
    <identificacionComprador>${invoice.customer.identification}</identificacionComprador>
    <totalSinImpuestos>${invoice.totals.subtotalSinImpuestos.toFixed(2)}</totalSinImpuestos>
    <importeTotal>${invoice.totals.total.toFixed(2)}</importeTotal>
    <moneda>USD</moneda>
  </infoFactura>
</factura>
`.trim();

  return { xml, accessKey };
}

/* ============================
   Helpers
============================ */
function mapIdType(type: string): string {
  switch (type) {
    case "ruc":
      return "04";
    case "cedula":
      return "05";
    case "pasaporte":
      return "06";
    default:
      return "05";
  }
}