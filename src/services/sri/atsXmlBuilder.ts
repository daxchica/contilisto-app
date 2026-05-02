// ============================================================================
// src/services/sri/atsXmlBuilder.ts
// CONTILISTO — ATS XML Builder (SRI CORRECT / PRODUCTION READY)
// ============================================================================

import type { AtsDocument } from "@/types/atsDocument";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const escapeXml = (value?: string) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const num = (v?: number) => Number(v ?? 0).toFixed(2);

const formatDate = (date?: string) => {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
};

const getTpId = (ruc: string) => {
  if (ruc?.length === 13) return "01";
  if (ruc?.length === 10) return "05";
  return "06";
};

/* -------------------------------------------------------------------------- */
/* MAIN                                                                       */
/* -------------------------------------------------------------------------- */

export function buildAtsXml({
  documents,
  period,
  ruc,
  razonSocial,
}: {
  documents: AtsDocument[];
  period: string;
  ruc: string;
  razonSocial: string;
}): string {

  const [anio, mes] = period.split("-");

  const compras = documents.filter(d => d.type === "purchase");
  const ventas = documents.filter(d => d.type === "sale");
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

  <Anio>${anio}</Anio>
  <Mes>${mes}</Mes>

  <numEstabRuc>001</numEstabRuc>
  <totalVentas>${num(totalVentas)}</totalVentas>

  <codigoOperativo>IVA</codigoOperativo>
`;

  /* ===============================
     COMPRAS
  =============================== */

  xml += `<compras>`;

  for (const doc of compras) {

    const rucProv = doc.counterpartyRUC || "9999999999999";

    xml += `
    <detalleCompras>

      <tpIdProv>${getTpId(rucProv)}</tpIdProv>
      <idProv>${escapeXml(rucProv)}</idProv>

      <tipoComprobante>01</tipoComprobante>
      <parteRel>NO</parteRel>

      <fechaRegistro>${formatDate(doc.date)}</fechaRegistro>

      <establecimiento>${escapeXml(doc.establishment)}</establecimiento>
      <puntoEmision>${escapeXml(doc.emissionPoint)}</puntoEmision>
      <secuencial>${escapeXml(doc.sequential)}</secuencial>

      <fechaEmision>${formatDate(doc.date)}</fechaEmision>
      <autorizacion>${escapeXml(doc.authorizationNumber)}</autorizacion>

      <baseNoGraIva>${num(doc.base0)}</baseNoGraIva>
      <baseImponible>0.00</baseImponible>
      <baseImpGrav>${num(doc.base12)}</baseImpGrav>

      <montoIva>${num(doc.iva)}</montoIva>
      <montoIce>${num(doc.ice)}</montoIce>

      <valorRetencionIva>${num(doc.ivaRetention)}</valorRetencionIva>

      <formasDePago>
        <formaPago>20</formaPago>
      </formasDePago>
`;

    /* 🔥 ONLY RENTA goes into AIR */
    const rentaRet = doc.retenciones?.filter(r => r.taxType === "RENTA") || [];

    if (rentaRet.length) {
      xml += `<air>`;

      for (const r of rentaRet) {
        xml += `
        <detalleAir>
          <codRetAir>${escapeXml(r.code)}</codRetAir>
          <baseImpAir>${num(r.base)}</baseImpAir>
          <porcentajeAir>${num(r.percentage)}</porcentajeAir>
          <valRetAir>${num(r.amount)}</valRetAir>
        </detalleAir>
        `;
      }

      xml += `</air>`;
    }

    xml += `</detalleCompras>`;
  }

  xml += `</compras>`;


  /* ===============================
     VENTAS
  =============================== */

  xml += `<ventas>`;

  for (const doc of ventas) {

    const rucCli = doc.counterpartyRUC || "9999999999999";

    xml += `
    <detalleVentas>

      <tpIdCliente>${getTpId(rucCli)}</tpIdCliente>
      <idCliente>${escapeXml(rucCli)}</idCliente>

      <parteRel>NO</parteRel>

      <tipoComprobante>01</tipoComprobante>
      <numeroComprobantes>1</numeroComprobantes>

      <baseNoGraIva>${num(doc.base0)}</baseNoGraIva>
      <baseImponible>0.00</baseImponible>
      <baseImpGrav>${num(doc.base12)}</baseImpGrav>

      <montoIva>${num(doc.iva)}</montoIva>
      <montoIce>${num(doc.ice)}</montoIce>

      <valorRetencionIva>${num(doc.ivaRetention)}</valorRetencionIva>
      <valorRetencionRenta>${num(doc.rentaRetention)}</valorRetencionRenta>

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

    const rucProv = doc.counterpartyRUC || "9999999999999";

    for (const r of doc.retenciones || []) {

      xml += `
      <detalleRetenciones>

        <tpIdProv>${getTpId(rucProv)}</tpIdProv>
        <idProv>${escapeXml(rucProv)}</idProv>

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