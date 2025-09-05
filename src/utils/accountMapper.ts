// src/utils/accountMapper.ts

/**
 * Normalizador entre lo que devuelve la IA y tu Plan de Cuentas canónico.
 *
 * Objetivo:
 * - Si la IA trae códigos de 5 dígitos (PUC abreviado), convertirlos a 7 dígitos.
 * - Si la IA trae nombres genéricos ("Compras locales", "Otros tributos"...),
 *   mapearlos al nombre oficial de tu catálogo.
 * - Siempre devolver un par coherente { account_code, account_name } existente
 *   en el catálogo (para que el <select> de "Código" se fije y no quede en "-- Seleccionar --").
 */

export type CanonAccount = { code: string; name: string };

// --- Tabla de equivalencias CÓDIGO 5d -> 7d (ajústala a tu PUC canónico)
const CODE_EQUIV_5D_TO_7D: Record<string, CanonAccount> = {
  // Compras
  "60601": { code: "5010101", name: "Compras de Mercaderías" },
  // ICE
  "53901": { code: "5010199", name: "Otros Impuestos a la Producción y Consumo (ICE)" },
  // IVA crédito
  "24301": { code: "1140101", name: "IVA Crédito Tributario" },
  // CxP comerciales locales
  "21101": { code: "2110101", name: "Cuentas por Pagar Comerciales - Nacionales" },
  // IVA crédito (7d que ya usas en tus asientos)
  "1010501": { code: "1010501", name: "CRÉDITO TRIBUTARIO A FAVOR DE LA EMPRESA (IVA)" }, // si usas esta denominación en UI
};

// --- Aliases de NOMBRES que devuelve la IA -> tu nombre oficial
const NAME_ALIASES: Array<{ test: RegExp; target: CanonAccount }> = [
  // Compras
  {
    test: /^(compra|compras)(\s+local(es)?)?$/i,
    target: { code: "5010101", name: "Compras de Mercaderías" },
  },
  {
    test: /^compras netas locales/i,
    target: { code: "5010101", name: "Compras de Mercaderías" },
  },

  // ICE
  {
    test: /otros\s+tributos|ice/i,
    target: { code: "5010199", name: "Otros Impuestos a la Producción y Consumo (ICE)" },
  },

  // IVA crédito
  {
    test: /iva\s*(cr[eé]dito)?\s*(tributario)?/i,
    target: { code: "1140101", name: "IVA Crédito Tributario" },
  },
  {
    // variante que ya aparece en tu UI
    test: /^cr[eé]dito\s+tributario\s+a\s+favor\s+de\s+la\s+empresa\s*\(iva\)/i,
    target: { code: "1010501", name: "CRÉDITO TRIBUTARIO A FAVOR DE LA EMPRESA (IVA)" },
  },

  // CxP
  {
    test: /cuentas?\s+por\s+pagar\s+comerciales?\s+local(es)?/i,
    target: { code: "2110101", name: "Cuentas por Pagar Comerciales - Nacionales" },
  },
];

// --- Normalizador principal
export function normalizeAIAccount(
  raw: { account_code?: string; account_name?: string }
): CanonAccount | null {
  // 1) Si trae código 7 dígitos y es conocido, úsalo tal cual
  if (raw.account_code && /^\d{7}$/.test(raw.account_code)) {
    const hit = CODE_EQUIV_5D_TO_7D[raw.account_code];
    if (hit) return hit; // p.ej. 1010501 definido arriba
  }

  // 2) Si trae código 5 dígitos, conviértelo
  if (raw.account_code && /^\d{5}$/.test(raw.account_code)) {
    const eq = CODE_EQUIV_5D_TO_7D[raw.account_code];
    if (eq) return eq;
  }

  // 3) Si trae solo nombre, intenta alias
  if (raw.account_name) {
    const n = raw.account_name.trim();
    for (const a of NAME_ALIASES) {
      if (a.test.test(n)) return a.target;
    }
  }

  return null;
}

/**
 * Aplica el normalizador a una línea de asiento, retornando
 * un patch con {account_code, account_name} si se pudo resolver.
 */
export function mapAIToCanonicalPatch(row: {
  account_code?: string;
  account_name?: string;
}): Partial<{ account_code: string; account_name: string }> {
  const canon = normalizeAIAccount(row);
  if (canon) return { account_code: canon.code, account_name: canon.name };
  return {};
}