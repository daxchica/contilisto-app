// src/utils/accountPUCMap.ts
// =======================================================
// PUC Ecuador unificado (derivado de ECUADOR_COA) + alias IA
// =======================================================
//
// Objetivo:
// - Usar src/data/ecuador_coa.ts como fuente maestra.
// - Exponer un subconjunto “operativo” de 7 dígitos para UI/AI.
// - Aceptar entradas “sucias” (nombres variables y/o códigos 5 dígitos).
// - Devolver SIEMPRE {code,name} canónicos de 7 dígitos.
// =======================================================

import { ECUADOR_COA, type Account as RawCOAAccount } from "../../src/data/ecuador_coa";

// ---------------------------
// Tipos públicos
// ---------------------------
export type PUCType =
  | "asset"
  | "liability"
  | "equity"
  | "income"
  | "expense"
  | "other";

export interface PUCAccount {
  code: string;   // SIEMPRE 7 dígitos en canónico
  name: string;   // Nombre visible en la UI
  type?: PUCType; // Sugerido; informativo
}

// ---------------------------
// Helpers internos
// ---------------------------
const norm = (s?: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const is7d = (c?: string) => !!c && /^\d{7}$/.test(c);

// Índices de búsqueda sobre el COA completo
const COA_BY_CODE = new Map<string, string>(
  ECUADOR_COA.map((a) => [a.code, a.name])
);

// Para resolver por nombre (normalizado) → lista de códigos que lo contienen o inician
const COA_NAME_INDEX = (() => {
  const m = new Map<string, string[]>();
  for (const { code, name } of ECUADOR_COA) {
    const n = norm(name);
    const arr = m.get(n) || [];
    arr.push(code);
    m.set(n, arr);
  }
  return m;
})();

// ---------------------------
// Conjunto canónico operativo (7 dígitos)
// • Elegimos códigos del COA que cubren tu flujo de gastos
//   y que se muestran en la UI.
// • Si quieres usar otros, cámbialos aquí.
// ---------------------------
//
// Compras locales (costo): usamos “(+) COMPRAS NETAS LOCALES DE MATERIA PRIMA”
// del COA oficial -> 5010106
//
// ICE (gasto de tributos no IVA): usamos “IMPUESTOS, CONTRIBUCIONES Y OTROS”
// (gasto administrativo) -> 5020220
//
// IVA crédito en compras: “CRÉDITO TRIBUTARIO A FAVOR DE LA EMPRESA (IVA)” -> 1010501
//
// Proveedores (CxP locales): “PROVEEDORES” (pasivo corriente) -> 2010301 02
//   OJO: En tu versión anterior usabas 2110101 (custom). Aquí normalizamos al COA.
//
const CANONICAL_CHOICES: Array<{ code: string; name?: string; type?: PUCType }> =
  [
    // Activo (IVA crédito)
    { code: "1010501", type: "asset" }, // CRÉDITO TRIBUTARIO A FAVOR DE LA EMPRESA (IVA)

    // Pasivo (CxP Proveedores locales)
    { code: "201030102", type: "liability" }, // PROVEEDORES

    // Costos / Compras
    { code: "5010106", type: "expense" }, // (+) COMPRAS NETAS LOCALES DE MATERIA PRIMA

    // ICE (gasto)
    { code: "5020220", type: "expense" }, // IMPUESTOS, CONTRIBUCIONES Y OTROS
  ];

// Construimos el mapa canónico de 7 dígitos con nombres del COA.
// Puedes sobreescribir el nombre visible con el campo `name` en CANONICAL_CHOICES.
const PUC_CANONICAL: Record<string, PUCAccount> = (() => {
  const out: Record<string, PUCAccount> = {};
  for (const { code, name, type } of CANONICAL_CHOICES) {
    const coaName = COA_BY_CODE.get(code);
    if (!coaName) continue; // ignora códigos inexistentes en el COA
    out[code] = {
      code,
      name: name ?? coaName,
      type,
    };
  }
  return out;
})();

// ---------------------------
// Mapeo legado 5d → 7d canónico (compatibilidad)
// ---------------------------
//
// Mantén estos para absorber salidas antiguas de la IA o historia previa.
// Ajusta a tus elecciones en CANONICAL_CHOICES.
//
const LEGACY_5D_TO_7D: Record<string, string> = {
  // Compras locales → usamos 5010106 (COA)
  "60601": "5010106",

  // Otros tributos (ICE) → mapeamos al gasto de impuestos del COA
  "53901": "5020220",

  // IVA crédito
  "24301": "1010501",

  // Cuentas por pagar comerciales locales (tu código antiguo 21101)
  // → normalizamos al COA “PROVEEDORES”
  "21101": "201030102",
};

// ---------------------------
// Alias de nombres frecuentes de IA/OCR → 7d canónico
// (keys en lower/sin tildes)
// ---------------------------
const NAME_ALIASES: Record<string, string> = {
  // Compras
  "compras": "5010106",
  "compras locales": "5010106",
  "compras de mercaderias": "5010106",
  "compras de mercaderia": "5010106",
  "(+) compras netas locales de materia prima": "5010106",

  // ICE
  "ice": "5020220",
  "otros tributos": "5020220",
  "otros impuestos a la produccion y consumo (ice)": "5020220",

  // IVA crédito
  "iva credito tributario": "1010501",
  "credito tributario a favor de la empresa (iva)": "1010501",
  "iva compras": "1010501",

  // CxP comerciales / Proveedores
  "cuentas por pagar comerciales locales": "201030102",
  "proveedores": "201030102",
  "proveedores nacionales": "201030102",
};

// ---------------------------
// Resolución / Canonización
// ---------------------------

/** Devuelve el nombre canónico para un código 7 dígitos del conjunto operativo. */
export function nameByCode(code?: string): string | undefined {
  if (!code || !is7d(code)) return undefined;
  return PUC_CANONICAL[code]?.name;
}

/**
 * Intenta obtener el código canónico (7d del conjunto operativo) a partir de:
 *  - un código 7d exacto de nuestro set,
 *  - un código 5d legado,
 *  - un nombre/etiqueta (alias) o un nombre oficial del COA.
 */
export function canonicalCodeFrom(codeOrName?: string): string | undefined {
  if (!codeOrName) return undefined;

  const raw = codeOrName.trim();

  // 0) Si viene en formato "xxxxxxx — Nombre", extrae el prefijo numérico.
  const pref = raw.match(/^(\d{2,})\s*[—-]\s*/)?.[1] ?? raw;

  // 1) 7 dígitos exacto y está en el set operativo
  if (is7d(pref) && PUC_CANONICAL[pref]) return pref;

  // 2) 5 dígitos legado
  if (/^\d{5}$/.test(pref) && LEGACY_5D_TO_7D[pref]) return LEGACY_5D_TO_7D[pref];

  // 3) Alias por nombre “popular”
  const alias = NAME_ALIASES[norm(raw)];
  if (alias) return alias;

  // 4) Nombre exacto del COA → reducimos a 7 dígitos preferidos si hay relación clara
  const n = norm(raw);
  // a) match exacto a un nombre del COA
  const exactCodes = COA_NAME_INDEX.get(n) ?? [];
  for (const c of exactCodes) {
    // si el código COA tiene más de 7 dígitos, intenta colapsar al prefijo 7d
    if (is7d(c) && PUC_CANONICAL[c]) return c;
    const prefix7 = c.slice(0, 7);
    if (is7d(prefix7) && PUC_CANONICAL[prefix7]) return prefix7;
  }

  // b) startsWith / includes sobre nombres del COA → colapsa al prefijo 7d preferido
  for (const [coaCode, coaName] of COA_BY_CODE) {
    const nn = norm(coaName);
    if (nn.startsWith(n) || nn.includes(n)) {
      const pref7 = coaCode.slice(0, 7);
      if (is7d(pref7) && PUC_CANONICAL[pref7]) return pref7;
    }
  }

  return undefined;
}

/** Devuelve el par canónico {code,name} (si puede) desde {code?,name?} “sucios”. */
export function canonicalPair(input: {
  code?: string;
  name?: string;
}): { code?: string; name?: string } {
  let code = canonicalCodeFrom(input.code);
  if (!code) code = canonicalCodeFrom(input.name);

  if (code) {
    const nm = nameByCode(code);
    return { code, name: nm };
  }
  return { code: input.code, name: input.name };
}

/** Normaliza en sitio una línea {account_code, account_name}. */
export function normalizeEntry<
  T extends { account_code?: string; account_name?: string }
>(e: T): T {
  const { code, name } = canonicalPair({
    code: e.account_code,
    name: e.account_name,
  });
  return { ...e, account_code: code, account_name: name };
}

// ---------------------------
// Catálogo para la UI (solo 7 dígitos operativos)
// ---------------------------
export function getAccountsForUI(): PUCAccount[] {
  return Object.values(PUC_CANONICAL).sort((a, b) =>
    a.code.localeCompare(b.code, "es", { numeric: true })
  );
}

export function findAccountByCode(code?: string): PUCAccount | undefined {
  if (!code) return undefined;
  return PUC_CANONICAL[code];
}

export function findAccountByName(name?: string): PUCAccount | undefined {
  const c = canonicalCodeFrom(name);
  return c ? PUC_CANONICAL[c] : undefined;
}

// ---------------------------
// Atajos para la IA (GASTOS) – todos 7 dígitos COA
// ---------------------------
export const PUCExpenseStructure = {
  subtotal: { code: "5010106", name: nameByCode("5010106")! },  // Compras netas locales MP
  ice:      { code: "5020220", name: nameByCode("5020220")! },  // Impuestos, contribuciones y otros
  iva:      { code: "1010501", name: nameByCode("1010501")! },  // Crédito tributario IVA (compras)
  total:    { code: "201030102", name: nameByCode("201030102")! }, // Proveedores
};

// ---------------------------
// Export “bruto” (por si necesitas inspeccionar)
// ---------------------------
export const PUCAccountsFull: Record<string, PUCAccount> = PUC_CANONICAL;

/*
Guía de uso
-----------
1) Modal / UI:
   const accounts = getAccountsForUI(); // sólo 7 dígitos del COA (con nombres visibles)
   <JournalPreviewModal accounts={accounts} ... />

2) Normalización:
   - Entradas de IA/OCR (o regex) → normalizeEntry(line)
   - Esto convierte 60601→5010106, 53901→5020220, 21101→201030102, etc.

3) Si cambias la política (p.ej. usar otra cuenta de compras):
   - Edita CANONICAL_CHOICES y (opcional) LEGACY_5D_TO_7D / NAME_ALIASES.
*/