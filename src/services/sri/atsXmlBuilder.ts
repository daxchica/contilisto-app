// ============================================================================
// src/services/sri/atsXmlBuilder.ts
// CONTILISTO — ATS XML Builder
// Builds ATS XML from normalized ATS documents
// ============================================================================

import type { AtsDocument } from "@/types/atsDocument";

/* =============================================================================
   TYPES
============================================================================= */

export interface AtsXmlParams {

  documents: AtsDocument[];

  period: string;

  ruc: string;

  razonSocial: string;

  anio: string;

  mes: string;

}

/* =============================================================================
   HELPERS
============================================================================= */

const escapeXml = (value?: string) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const num = (v?: number) => (v ?? 0).toFixed(2);

/* =============================================================================
   MAIN BUILDER
============================================================================= */

export function buildAtsXml({
  documents,
  ruc,
  razonSocial,
  anio,
  mes,
}: AtsXmlParams): string {

  const compras = documents.filter(d => d.documentType === "01");
  const ventas = documents.filter(d => d.documentType === "18");
  const retenciones = documents.filter(d => d.documentType === "07");

  let xml = `<?xml version="1.0" encoding="UTF-8"?>`;

  xml += `
<iva>
  <TipoIDInformante>R</TipoIDInformante>
  <IdInformante>${ruc}</IdInformante>
  <razonSocial>${escapeXml(razonSocial)}</razonSocial>
  <Anio>${anio}</Anio>
  <Mes>${mes}</Mes>
`;

  /* =============================================================================
     COMPRAS
  ============================================================================= */

  xml += `<compras>`;

  for (const doc of compras) {

    xml += `
    <detalleCompras>

      <tpIdProv>01</tpIdProv>

      <idProv>${doc.ruc}</idProv>

      <tipoComprobante>${doc.documentType}</tipoComprobante>

      <establecimiento>${doc.establishment ?? "001"}</establecimiento>

      <puntoEmision>${doc.emissionPoint ?? "001"}</puntoEmision>

      <secuencial>${doc.sequential}</secuencial>

      <autorizacion>${doc.authorizationNumber ?? ""}</autorizacion>

      <fechaRegistro>${doc.date}</fechaRegistro>

      <baseNoGraIva>${num(doc.base0)}</baseNoGraIva>

      <baseImponible>${num(doc.base12)}</baseImponible>

      <baseImpGrav>${num(doc.base12)}</baseImpGrav>

      <montoIva>${num(doc.iva)}</montoIva>

    </detalleCompras>
    `;
  }

  xml += `</compras>`;


  /* =============================================================================
     VENTAS
  ============================================================================= */

  xml += `<ventas>`;

  for (const doc of ventas) {

    xml += `
    <detalleVentas>

      <tpIdCliente>01</tpIdCliente>

      <idCliente>${doc.ruc}</idCliente>

      <tipoComprobante>${doc.documentType}</tipoComprobante>

      <numeroComprobantes>1</numeroComprobantes>

      <baseNoGraIva>${num(doc.base0)}</baseNoGraIva>

      <baseImponible>${num(doc.base12)}</baseImponible>

      <montoIva>${num(doc.iva)}</montoIva>

    </detalleVentas>
    `;
  }

  xml += `</ventas>`;


  /* =============================================================================
     RETENCIONES
  ============================================================================= */

  xml += `<retenciones>`;

  for (const doc of retenciones) {

    if (!doc.retenciones?.length) continue;

    for (const r of doc.retenciones) {

      xml += `
      <detalleRetenciones>

        <tpIdProv>01</tpIdProv>

        <idProv>${doc.ruc}</idProv>

        <codigo>${r.code}</codigo>

        <baseImponible>${num(r.base)}</baseImponible>

        <porcentajeRetener>${r.percentage}</porcentajeRetener>

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