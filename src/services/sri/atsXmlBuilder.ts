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

// Tabla 2: COMPRAS uses codes 01/02/03; VENTAS uses codes 04/05/06/07
const getTpIdCompra = (ruc: string) => {
  if (ruc?.length === 13) return "01"; // RUC
  if (ruc?.length === 10) return "02"; // Cédula
  return "03";                          // Pasaporte / id tributaria exterior
};

const getTpIdVenta = (ruc: string) => {
  if (ruc === "9999999999999") return "07"; // Consumidor Final
  if (ruc?.length === 13) return "04";      // RUC
  if (ruc?.length === 10) return "05";      // Cédula
  return "06";                               // Pasaporte / id tributaria exterior
};

/** Map IVA retention amount to the correct SRI field by percentage. */
function ivaRetFields(retenciones: Array<{ taxType: string; percentage: number; amount: number }>) {
  const ivaRets = retenciones.filter(r => r.taxType === "IVA");
  const byPct = (pct: number) => ivaRets.find(r => r.percentage === pct)?.amount ?? 0;
  return {
    valRetBien10:      byPct(10),
    valRetServ20:      byPct(20),
    valorRetBienes:    byPct(30),
    valRetServ50:      byPct(50),
    valorRetServicios: byPct(70),
    valRetServ100:     byPct(100),
  };
}

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
    const ivaPct = ivaRetFields(doc.retenciones ?? []);

    xml += `
    <detalleCompras>

      <codSustento>01</codSustento>

      <tpIdProv>${getTpIdCompra(rucProv)}</tpIdProv>
      <idProv>${escapeXml(rucProv)}</idProv>

      <tipoComprobante>${escapeXml(doc.documentType || "01")}</tipoComprobante>
      <parteRel>NO</parteRel>

      <fechaRegistro>${formatDate(doc.date)}</fechaRegistro>

      <establecimiento>${escapeXml(doc.establishment)}</establecimiento>
      <puntoEmision>${escapeXml(doc.emissionPoint)}</puntoEmision>
      <secuencial>${escapeXml(doc.sequential)}</secuencial>

      <fechaEmision>${formatDate(doc.date)}</fechaEmision>
      <autorizacion>${escapeXml(doc.authorizationNumber)}</autorizacion>

      <baseNoGraIva>${num(doc.baseNoObjeto ?? 0)}</baseNoGraIva>
      <baseImponible>${num(doc.base0)}</baseImponible>
      <baseImpGrav>${num(doc.base12)}</baseImpGrav>
      <baseImpExe>0.00</baseImpExe>

      <montoIce>${num(doc.ice)}</montoIce>
      <montoIva>${num(doc.iva)}</montoIva>

      <valRetBien10>${num(ivaPct.valRetBien10)}</valRetBien10>
      <valRetServ20>${num(ivaPct.valRetServ20)}</valRetServ20>
      <valorRetBienes>${num(ivaPct.valorRetBienes)}</valorRetBienes>
      <valRetServ50>${num(ivaPct.valRetServ50)}</valRetServ50>
      <valorRetServicios>${num(ivaPct.valorRetServicios)}</valorRetServicios>
      <valRetServ100>${num(ivaPct.valRetServ100)}</valRetServ100>

      <pagoLocExt>01</pagoLocExt>

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
    const ventaTotal = (doc.base12 ?? 0) + (doc.base0 ?? 0) + (doc.baseNoObjeto ?? 0);

    xml += `
    <detalleVentas>

      <tpIdCliente>${getTpIdVenta(rucCli)}</tpIdCliente>
      <idCliente>${escapeXml(rucCli)}</idCliente>

      <parteRel>NO</parteRel>

      <tipoComprobante>${escapeXml(doc.documentType || "01")}</tipoComprobante>
      <tipoEm>1</tipoEm>
      <numeroComprobantes>1</numeroComprobantes>

      <baseNoGraIva>${num(doc.baseNoObjeto ?? 0)}</baseNoGraIva>
      <baseImponible>${num(doc.base0)}</baseImponible>
      <baseImpGrav>${num(doc.base12)}</baseImpGrav>

      <montoIva>${num(doc.iva)}</montoIva>
      <montoIce>${num(doc.ice)}</montoIce>

      <valorRetIva>${num(doc.ivaRetention)}</valorRetIva>
      <valorRetRenta>${num(doc.rentaRetention)}</valorRetRenta>

      <formasDePago>
        <formaPago>20</formaPago>
      </formasDePago>

      <establecimientos>
        <codEstab>001</codEstab>
        <ventasEstab>${num(ventaTotal)}</ventasEstab>
        <ivaComp>0.00</ivaComp>
      </establecimientos>

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

        <tpIdProv>${getTpIdCompra(rucProv)}</tpIdProv>
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