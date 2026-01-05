import { sriRecepcion, sriAutorizacion } from "../_lib/sriSoap";

export async function sendToSri(params: {
  environment: "1" | "2";
  signedXml: string;
  accessKey: string;
}) {
  const { environment, signedXml, accessKey } = params;

  // 1️⃣ RECEPCIÓN
  const recep = await sriRecepcion({
    ambiente: environment,
    xmlSigned: signedXml,
  });

  if (!recep.ok) {
    return {
      ok: false,
      step: "recepcion",
      raw: recep.raw,
    };
  }

  // 2️⃣ AUTORIZACIÓN
  const auth = await sriAutorizacion({
    ambiente: environment,
    claveAcceso: accessKey,
  });

  return {
    ok: auth.ok,
    recepcionOk: recep.ok,
    autorizacionOk: auth.ok,
    raw: {
      recepcion: recep.raw,
      autorizacion: auth.raw,
    },
  };
}