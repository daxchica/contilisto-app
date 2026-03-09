// ============================================================================
// src/services/sri/atsXmlBuilder.ts
// CONTILISTO — ATS XML Builder (SRI Compatible)
// ============================================================================

import type { AtsDocument } from "@/types/atsDocument";

export interface AtsXmlParams {
  documents: AtsDocument[];
  period: string;
  ruc: string;
  razonSocial: string;
  anio?: string;
  mes?: string;
}

const escapeXml = (value?: string) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const num = (v?: number) => Number(v ?? 0).toFixed(2);

export function buildAtsXml({
  documents,
  period,
  ruc,
  razonSocial,
  anio,
  mes,
}: AtsXmlParams): string {

  const [yearFromPeriod = "", monthFromPeriod = ""] = String(period).split("-");

  const safeAnio = anio ?? yearFromPeriod;
  const safeMes = mes ?? monthFromPeriod;

  const compras = documents.filter(d => d.documentType === "01");
  const ventas = documents.filter(d => d.documentType === "18");
  const retenciones = documents.filter(d => d.documentType === "07");

  const totalVentas = ventas.reduce(
    (acc, d) => acc + (d.base12 ?? 0) + (d.base0 ?? 0),
    0
  );

  let xml = `<?xml version="1.0" encoding="UTF-8"?>`;

  xml += `
<iva>
  <TipoIDInformante>R</TipoIDInformante>
  <IdInformante>${escapeXml(ruc)}</IdInformante>
  <razonSocial>${escapeXml(razonSocial)}</razonSocial>

  <Anio>${safeAnio}</Anio>
  <Mes>${safeMes}</Mes>

  <numEstabRuc>001</numEstabRuc>

  <totalVentas>${num(totalVentas)}</totalVentas>

  <codigoOperativo>IVA</codigoOperativo>
`;

  /* ===============================
     COMPRAS
  =============================== */

  xml += `<compras>`;

  for (const doc of compras) {

    xml += `
    <detalleCompras>

      <tpIdProv>01</tpIdProv>

      <idProv>${escapeXml(doc.ruc)}</idProv>

      <tipoComprobante>${escapeXml(doc.documentType)}</tipoComprobante>

      <parteRel>NO</parteRel>

      <fechaRegistro>${escapeXml(doc.date)}</fechaRegistro>

      <establecimiento>${escapeXml(doc.establishment ?? "001")}</establecimiento>

      <puntoEmision>${escapeXml(doc.emissionPoint ?? "001")}</puntoEmision>

      <secuencial>${escapeXml(doc.sequential ?? "")}</secuencial>

      <fechaEmision>${escapeXml(doc.date)}</fechaEmision>

      <autorizacion>${escapeXml(doc.authorizationNumber ?? "")}</autorizacion>

      <baseNoGraIva>${num(doc.base0)}</baseNoGraIva>

      <baseImponible>0.00</baseImponible>

      <baseImpGrav>${num(doc.base12)}</baseImpGrav>

      <montoIva>${num(doc.iva)}</montoIva>

      <montoIce>${num(doc.ice)}</montoIce>

      <valorRetencionIva>0.00</valorRetencionIva>

      <formasDePago>

        <formaPago>20</formaPago>

      </formasDePago>

    </detalleCompras>
    `;
  }

  xml += `</compras>`;

  /* ===============================
     VENTAS
  =============================== */

  xml += `<ventas>`;

  for (const doc of ventas) {

    xml += `
    <detalleVentas>

      <tpIdCliente>01</tpIdCliente>

      <idCliente>${escapeXml(doc.ruc)}</idCliente>

      <parteRel>NO</parteRel>

      <tipoComprobante>${escapeXml(doc.documentType)}</tipoComprobante>

      <numeroComprobantes>1</numeroComprobantes>

      <baseNoGraIva>${num(doc.base0)}</baseNoGraIva>

      <baseImponible>0.00</baseImponible>

      <baseImpGrav>${num(doc.base12)}</baseImpGrav>

      <montoIva>${num(doc.iva)}</montoIva>

      <montoIce>${num(doc.ice)}</montoIce>

      <valorRetencionIva>0.00</valorRetencionIva>

      <valorRetencionRenta>0.00</valorRetencionRenta>

      <formasDePago>

        <formaPago>20</formaPago>

      </formasDePago>

    </detalleVentas>
    `;
  }

  xml += `</ventas>`;

  /* ===============================
     RETENCIONES
  =============================== */

  xml += `<retenciones>`;

  for (const doc of retenciones) {

    if (!doc.retenciones?.length) continue;

    for (const r of doc.retenciones) {

      xml += `
      <detalleRetenciones>

        <tpIdProv>01</tpIdProv>

        <idProv>${escapeXml(doc.ruc)}</idProv>

        <codigo>${escapeXml(r.code)}</codigo>

        <baseImponible>${num(r.base)}</baseImponible>

        <porcentajeRetener>${num(r.percentage)}</porcentajeRetener>

        <valorRetenido>${num(r.amount)}</valorRetenido>

      </detalleRetenciones>
      `;
    }
  }

  xml += `</retenciones>`;

  xml += `
</iva>
`;

  return xml;

}