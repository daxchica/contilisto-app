// backend/utils/accountPUCMap.ts
// =======================================================
// One source of truth built on the official Ecuador COA.
// - Reads from @coa/ECUADOR_COA
// - Provides canonical helpers for UI & AI
// - Bridges legacy 5/7-digit codes you've used to the official COA
// =======================================================

import { ECUADOR_COA } from "../../shared/coa/ecuador_coa";

// ---------------------------
// Utilities
// ---------------------------
const norm = (s?: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const is7d = (c?: string) => !!c && /^\d{7}$/.test(c);
const is5d = (c?: string) => !!c && /^\d{5}$/.test(c);
const isNum = (c?: string) => !!c && /^\d+$/.test(c);

// ---------------------------
// Index official COA
// ---------------------------
type COAItem = { code: string; name: string };

const ALL: COAItem[] = ECUADOR_COA;

// Fast maps
const codeToName = new Map<string, string>();
const nameToCode = new Map<string, string>();

ALL.forEach((a) => {
  codeToName.set(a.code, a.name);
  nameToCode.set(norm(a.name), a.code);
});

// For dropdowns we normally prefer "operational" levels: 7–11 digits.
// You can adjust this if you want fewer/more granular codes.
const isOperationalDepth = (code: string) => code.length >= 7 && code.length <= 11;

// ---------------------------
// Legacy → Official bridges
// (These fix your current mismatches where UI couldn't select a code)
// ---------------------------
//
// Notes:
// - Your legacy "2110101 (CxP comerciales - nacionales)" doesn't exist in official COA;
//   map it to 201030102 (PROVEEDORES, Locales).
// - Legacy IVA crédito 1010501 exists in the official COA (great).
// - Legacy "Compras de Mercaderías" doesn't exist verbatim; for MVP periodic inventory,
//   we route generic purchases to 5020128 (SUMINISTROS Y MATERIALES) or a better bucket you choose.
// - Legacy ICE → we route to 5020220 (IMPUESTOS, CONTRIBUCIONES Y OTROS), which is close enough for MVP.
//
// If you later move to perpetual inventory, switch subtotal debit to 1010306 (inventario comprado a terceros).
//
const LEGACY_7D_TO_OFFICIAL_7D: Record<string, string> = {
  // CxP locales
  "2110101": "201030102",

  // IVA crédito (already official)
  "1010501": "1010501",

  // ICE (legacy bucket) → admin taxes
  "5010199": "5020220",

  // Compras de Mercaderías (legacy) → MVP expense bucket
  "5010101": "5020128",
};

// 5-digit legacy often seen in your earlier flows
const LEGACY_5D_TO_OFFICIAL_7D: Record<string, string> = {
  "21101": "201030102", // CxP locales
  "24301": "1010501",   // IVA crédito tributario
  "53901": "5020220",   // ICE → taxes
  "60601": "5020128",   // Compras locales → Suministros y materiales (MVP)
};

// ---------------------------
// Name Aliases → Official code
// (extend continuously with what the OCR/AI emits)
// ---------------------------
const NAME_ALIASES_TO_CODE: Record<string, string> = {
  // Purchases / generic spend
  "compras": "5020128",
  "compras locales": "5020128",
  "compras de mercaderias": "5020128",
  "suministros": "5020128",
  "suministros y materiales": "5020128",

  // ICE
  "ice": "5020220",
  "otros tributos": "5020220",
  "otros impuestos a la produccion y consumo (ice)": "5020220",

  // IVA crédito
  "iva credito tributario": "1010501",
  "credito tributario a favor de la empresa (iva)": "1010501",
  "iva compras": "1010501",

  // CxP
  "cuentas por pagar comerciales locales": "201030102",
  "proveedores": "201030102",
  "proveedores locales": "201030102",
  "proveedores nacionales": "201030102",
};

// ---------------------------
// Public helpers
// ---------------------------

export type CanonicalAccount = { code: string; name: string };

export function findOfficialName(code?: string) {
  return code ? codeToName.get(code) : undefined;
}

export function canonicalCodeFrom(input?: string): string | undefined {
  if (!input) return;

  const raw = input.trim();

  // Optional label "code — name": extract code
  const lead = raw.match(/^(\d{2,})\s*[—-]\s*/) ? RegExp.$1 : raw;

  // If official code exists, use it directly
  if (isNum(lead) && codeToName.has(lead)) return lead;

  // Legacy bridges
  if (is7d(lead) && LEGACY_7D_TO_OFFICIAL_7D[lead]) return LEGACY_7D_TO_OFFICIAL_7D[lead];
  if (is5d(lead) && LEGACY_5D_TO_OFFICIAL_7D[lead]) return LEGACY_5D_TO_OFFICIAL_7D[lead];

  // Alias by name
  const key = norm(raw);
  const fromAlias = NAME_ALIASES_TO_CODE[key];
  if (fromAlias) return fromAlias;

  // Exact name match inside official COA
  const byName = nameToCode.get(key);
  if (byName) return byName;

  // Starts-with → contains (prudent)
  for (const [nKey, code] of nameToCode.entries()) if (nKey.startsWith(key)) return code;
  for (const [nKey, code] of nameToCode.entries()) if (nKey.includes(key)) return code;

  return;
}

export function canonicalPair(input: { code?: string; name?: string }): CanonicalAccount | { code?: string; name?: string } {
  let code = canonicalCodeFrom(input.code);
  if (!code) code = canonicalCodeFrom(input.name);

  if (code) return { code, name: findOfficialName(code)! };
  return { code: input.code, name: input.name };
}

export function normalizeEntry<T extends { account_code?: string; account_name?: string }>(e: T): T {
  const pair = canonicalPair({ code: e.account_code, name: e.account_name });
  return { ...e, account_code: pair.code as any, account_name: pair.name as any };
}

export function getAccountsForUI(): CanonicalAccount[] {
  // Only operational depth to keep dropdown sane. Adjust if you want broader.
  return ALL.filter((a) => isOperationalDepth(a.code))
    .map((a) => ({ code: a.code, name: a.name }))
    .sort((x, y) => x.code.localeCompare(y.code, "es", { numeric: true }));
}

export function findAccountByCode(code?: string) {
  return code ? (codeToName.has(code) ? { code, name: codeToName.get(code)! } : undefined) : undefined;
}

export function findAccountByName(name?: string) {
  if (!name) return;
  const code = canonicalCodeFrom(name);
  return code ? { code, name: codeToName.get(code)! } : undefined;
}

// For AI presets (expense):
export const PUCExpenseStructure = {
  // MVP periodic inventory:
  subtotal: { code: "5020128", name: findOfficialName("5020128")! }, // Suministros y materiales
  ice:      { code: "5020220", name: findOfficialName("5020220")! }, // Impuestos, contribuciones y otros
  iva:      { code: "1010501", name: findOfficialName("1010501")! }, // Crédito tributario IVA (compras)
  total:    { code: "201030102", name: findOfficialName("201030102")! }, // Proveedores (locales)
};

// If you later switch to perpetual inventory, flip `subtotal.code` to "1010306".