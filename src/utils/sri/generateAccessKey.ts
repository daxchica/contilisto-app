// src/utils/sri/generateAccessKey.ts

export interface AccessKeyParams {
  date: string;        // YYYYMMDD
  docType: string;     // "01"
  ruc: string;
  ambiente: string;    // "1" | "2"
  estab: string;
  ptoEmi: string;
  secuencial: string;
}

export function generateAccessKey(params: AccessKeyParams): string {
  const raw =
    params.date +
    params.docType +
    params.ruc +
    params.ambiente +
    params.estab +
    params.ptoEmi +
    params.secuencial +
    "12345678" + // numeric code
    "1";         // tipoEmision

  const mod11 = computeMod11(raw);
  return raw + mod11;
}

function computeMod11(input: string): string {
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