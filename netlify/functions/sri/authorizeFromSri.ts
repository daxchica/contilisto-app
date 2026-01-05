// netlify/functions/sri/authorizeFromSri.ts
import fetch from "node-fetch";

/* ======================================================
   TYPES
====================================================== */

export interface AuthorizeFromSriParams {
  environment: "1" | "2"; // 1=test, 2=prod
  accessKey: string;
}

export interface SriAuthorizationResponse {
  autorizacion?: {
    estado: string;
    numeroAutorizacion?: string;
    fechaAutorizacion?: string;
    comprobante?: string;
    mensajes?: any[];
  };
  raw: any;
}

/* ======================================================
   ENDPOINTS
====================================================== */

function getAuthorizeUrl(env: "1" | "2") {
  return env === "1"
    ? "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl"
    : "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl";
}

/* ======================================================
   HELPERS
====================================================== */

function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1]?.trim();
}

function extractMultiple(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g");
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

/* ======================================================
   MAIN FUNCTION
====================================================== */

export async function authorizeFromSri(
  params: AuthorizeFromSriParams
): Promise<SriAuthorizationResponse> {
  const { environment, accessKey } = params;

  const url = getAuthorizeUrl(environment);

  const soapEnvelope = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                      xmlns:aut="http://ec.gob.sri.ws.autorizacion">
      <soapenv:Header/>
      <soapenv:Body>
        <aut:autorizacionComprobante>
          <claveAccesoComprobante>${accessKey}</claveAccesoComprobante>
        </aut:autorizacionComprobante>
      </soapenv:Body>
    </soapenv:Envelope>
  `.trim();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
    },
    body: soapEnvelope,
  });

  const rawXml = await response.text();

  const estado = extractTag(rawXml, "estado");

  if (!estado) {
    return { raw: rawXml };
  }

  /* ======================================================
     PARSE RESPONSE (SAFE)
  ====================================================== */
  return {
    autorizacion: {
      estado,
      numeroAutorizacion: extractTag(rawXml, "numeroAutorizacion"),
      fechaAutorizacion: extractTag(rawXml, "fechaAutorizacion"),
      comprobante: extractTag(rawXml, "comprobante"),
      mensajes: extractMultiple(rawXml, "mensaje"),
    },
    raw: rawXml,
  };
}