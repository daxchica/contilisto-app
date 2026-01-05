// ============================================================================
// sendToSRI.ts
// Envía el comprobante firmado al SRI: recepción + autorización (DTE v1.1.0)
// Compatible con ambiente PRUEBAS y PRODUCCIÓN
// ============================================================================

import axios from "axios";

export interface SendToSriParams {
  signedXml: string;      // XML firmado (cadena)
  claveAcceso: string;      // Clave de acceso de la factura
  environment: "1" | "2"; // 1 = pruebas, 2 = producción
}

export interface SriSendResult {
  estado: string;
  autorizacionXml?: string;
  autorizacionNumero?: string;
  fechaAutorizacion?: string;
  mensajes?: string[];
}

// ============================================================================
// ENDPOINTS DEL SRI
// ============================================================================
const SRI_URLS = {
  recepcion: {
    pruebas: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl",
    produccion: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl",
  },
  autorizacion: {
    pruebas: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl",
    produccion: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl",
  },
};

// ============================================================================
// SOAP HELPERS
// ============================================================================

function buildRecepcionSOAP(xmlBase64: string): string {
  return `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                      xmlns:ec="http://ec.gob.sri.ws.recepcion">
      <soapenv:Header/>
      <soapenv:Body>
        <ec:validarComprobante>
          <xml>${xmlBase64}</xml>
        </ec:validarComprobante>
      </soapenv:Body>
    </soapenv:Envelope>
  `;
}

function buildAutorizacionSOAP(claveAcceso: string): string {
  return `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                      xmlns:ec="http://ec.gob.sri.ws.autorizacion">
      <soapenv:Header/>
      <soapenv:Body>
        <ec:autorizacionComprobante>
          <claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>
        </ec:autorizacionComprobante>
      </soapenv:Body>
    </soapenv:Envelope>
  `;
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================
export async function sendToSRI(params: SendToSriParams): Promise<SriSendResult> {
  const { signedXml, claveAcceso, environment } = params;

  const xmlBase64 = Buffer.from(signedXml, "utf8").toString("base64");

  const recepcionUrl =
    environment === "1" ? SRI_URLS.recepcion.pruebas : SRI_URLS.recepcion.produccion;

  const autorizacionUrl =
    environment === "1" ? SRI_URLS.autorizacion.pruebas : SRI_URLS.autorizacion.produccion;

  // ========================================================================
  // 1) ENVÍO A RECEPCIÓN
  // ========================================================================

  const recepcionSoap = buildRecepcionSOAP(xmlBase64);

  let recepcionResponse: string;

  try {
    const { data } = await axios.post(recepcionUrl, recepcionSoap, {
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      timeout: 15000,
    });

    recepcionResponse = data;
  } catch (err: any) {
    throw new Error("Error conectando a SRI recepción: " + err.message);
  }

  // Validar respuesta
  if (!recepcionResponse.includes("<estado>RECIBIDA</estado>")) {
    const errores = extractSriErrors(recepcionResponse);
    return {
      estado: "DEVUELTA",
      mensajes: errores.length > 0 ? errores : ["SRI devolvió el comprobante en recepción"],
    };
  }

  // ========================================================================
  // 2) CONSULTAR AUTORIZACIÓN (demora 1–3 segundos)
  // ========================================================================

  await wait(2000);

  const autorizacionSoap = buildAutorizacionSOAP(claveAcceso);
  let autorizacionResponse: string;

  try {
    const { data } = await axios.post(autorizacionUrl, autorizacionSoap, {
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      timeout: 15000,
    });

    autorizacionResponse = data;
  } catch (err: any) {
    throw new Error("Error conectando a SRI autorización: " + err.message);
  }

  // RESPUESTA DE AUTORIZACIÓN
  if (autorizacionResponse.includes("<estado>AUTORIZADO</estado>")) {
    return {
      estado: "AUTORIZADO",
      autorizacionXml: extractTag(autorizacionResponse, "comprobante"),
      autorizacionNumero: extractTag(autorizacionResponse, "numeroAutorizacion"),
      fechaAutorizacion: extractTag(autorizacionResponse, "fechaAutorizacion"),
    };
  }

  const errores = extractSriErrors(autorizacionResponse);

  return {
    estado: "NO AUTORIZADO",
    mensajes: errores.length > 0 ? errores : ["El SRI no autorizó el comprobante"],
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTag(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1] : undefined;
}

function extractSriErrors(xml: string): string[] {
  const matches = [...xml.matchAll(/<mensaje>([\s\S]*?)<\/mensaje>/g)];
  return matches.map((m) => m[1]);
}