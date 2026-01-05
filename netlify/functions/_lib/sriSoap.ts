// netlify/functions/_lib/sriSoap.ts
type Ambiente = "1" | "2";

function getSriEndpoints(ambiente: Ambiente) {
  // ✅ Puedes ajustar a tus URLs exactas (pruebas vs producción)
  // Nota: las rutas concretas las defines tú según tu config actual.
  // Mantengo variables para que no te choque TypeScript.
  if (ambiente === "1") {
    return {
      recepcionUrl: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl",
      autorizacionUrl: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl",
    };
  }
  return {
    recepcionUrl: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl",
    autorizacionUrl: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl",
  };
}

function wrapSoap(bodyInner: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
    ${bodyInner}
  </soapenv:Body>
</soapenv:Envelope>`;
}

// XML firmado -> base64 (SRI lo recibe así)
export async function sriRecepcion(params: {
  ambiente: Ambiente;
  xmlSigned: string;
}) {
  const { recepcionUrl } = getSriEndpoints(params.ambiente);
  const xmlB64 = Buffer.from(params.xmlSigned, "utf8").toString("base64");

  const soap = wrapSoap(`
<ns2:validarComprobante xmlns:ns2="http://ec.gob.sri.ws.recepcion">
  <xml>${xmlB64}</xml>
</ns2:validarComprobante>`);

  const res = await fetch(recepcionUrl, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: soap,
  });

  const text = await res.text();
  return { ok: res.ok, raw: text };
}

export async function sriAutorizacion(params: {
  ambiente: Ambiente;
  claveAcceso: string;
}) {
  const { autorizacionUrl } = getSriEndpoints(params.ambiente);

  const soap = wrapSoap(`
<ns2:autorizacionComprobante xmlns:ns2="http://ec.gob.sri.ws.autorizacion">
  <claveAccesoComprobante>${params.claveAcceso}</claveAccesoComprobante>
</ns2:autorizacionComprobante>`);

  const res = await fetch(autorizacionUrl, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: soap,
  });

  const text = await res.text();
  return { ok: res.ok, raw: text };
}