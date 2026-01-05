// netlify/functions/_lib/generateClaveAcceso.ts

export interface GenerateClaveAccesoParams {
  issueDateISO: string;     // YYYY-MM-DD
  tipoComprobante: "01";   // factura
  ruc: string;
  ambiente: "1" | "2";
  estab: string;
  ptoEmi: string;
  secuencial: string;
}

function modulo11(input: string): string {
  let sum = 0;
  let factor = 2;

  for (let i = input.length - 1; i >= 0; i--) {
    sum += Number(input[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }

  const mod = 11 - (sum % 11);
  if (mod === 11) return "0";
  if (mod === 10) return "1";
  return String(mod);
}

export function generateClaveAcceso({
  issueDateISO,
  tipoComprobante,
  ruc,
  ambiente,
  estab,
  ptoEmi,
  secuencial,
}: GenerateClaveAccesoParams): string {
  const fecha = issueDateISO.replace(/-/g, "");
  const serie = estab + ptoEmi;
  const codigoNumerico = "12345678";
  const tipoEmision = "1";

  const base =
    fecha +
    tipoComprobante +
    ruc +
    ambiente +
    serie +
    secuencial.padStart(9, "0") +
    codigoNumerico +
    tipoEmision;

  return base + modulo11(base);
}