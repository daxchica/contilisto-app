// src/utils/sriAccessKey.ts
// Clave de acceso SRI (Ecuador) - Módulo 11
// Nota: valida contra el XSD/guía del SRI en tu implementación final.

export type AmbienteSri = "1" | "2"; // 1=Pruebas, 2=Producción
export type TipoEmisionSri = "1"; // normalmente 1=Normal

function padLeft(value: string | number, len: number, ch = "0") {
  return String(value).padStart(len, ch);
}

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D+/g, "");
}

// Módulo 11 (desde derecha a izquierda, pesos 2..7 repetidos)
export function modulo11CheckDigit(numericString: string): string {
  const s = onlyDigits(numericString);
  let sum = 0;
  let weight = 2;

  for (let i = s.length - 1; i >= 0; i--) {
    sum += Number(s[i]) * weight;
    weight = weight === 7 ? 2 : weight + 1;
  }

  const mod = sum % 11;
  const dv = 11 - mod;

  if (dv === 11) return "0";
  if (dv === 10) return "1";
  return String(dv);
}

/**
 * Construye la clave de acceso:
 * fecha(ddmmyyyy) + tipoComprobante(2) + ruc(13) + ambiente(1) + serie(6) + secuencial(9)
 * + codigoNumerico(8) + tipoEmision(1) + digitoVerificador(1)
 */
export function buildSriAccessKey(params: {
  issueDateISO: string;     // yyyy-mm-dd
  tipoComprobante: string;  // "01" factura, "04" NC, "07" retención, etc.
  ruc: string;              // 13 dígitos
  ambiente: AmbienteSri;    // "1"|"2"
  estab: string;            // 3 dígitos
  ptoEmi: string;           // 3 dígitos
  secuencial: string;       // 9 dígitos
  codigoNumerico?: string;  // 8 dígitos (si no, generamos)
  tipoEmision?: TipoEmisionSri; // default "1"
}): string {
  const { issueDateISO, tipoComprobante, ruc, ambiente, estab, ptoEmi, secuencial } = params;

  const [yyyy, mm, dd] = issueDateISO.split("-");
  const fecha = `${padLeft(dd, 2)}${padLeft(mm, 2)}${padLeft(yyyy, 4)}`;

  const serie = `${padLeft(estab, 3)}${padLeft(ptoEmi, 3)}`;
  const sec = padLeft(onlyDigits(secuencial), 9);
  const codNum = padLeft(onlyDigits(params.codigoNumerico ?? String(Math.floor(Math.random() * 10 ** 8))), 8);
  const tipoEmi = params.tipoEmision ?? "1";

  const base = `${fecha}${padLeft(tipoComprobante, 2)}${padLeft(onlyDigits(ruc), 13)}${ambiente}${serie}${sec}${codNum}${tipoEmi}`;
  const dv = modulo11CheckDigit(base);

  return `${base}${dv}`;
}