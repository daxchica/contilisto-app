// src/shared/puc.ts

export type PUCAccount = { code: string; name: string };

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** —— EXPENSE (Compras / Proveedores) —— */
export const PUCExpense: Record<"subtotal"|"iva"|"ice"|"ir"|"total", PUCAccount> = {
  // Match what the UI is actually using (see your screenshots/logs)
  subtotal: { code: "5010106", name: "(+) COMPRAS NETAS LOCALES DE MATERIA PRIMA" }, // or "Compras locales" if that’s your label
  iva:      { code: "1010501", name: "CRÉDITO TRIBUTARIO A FAVOR DE LA EMPRESA (IVA)" },
  ice:      { code: "53901",   name: "Otros tributos" }, // keep if you really use ICE; otherwise leave unused
  ir:       { code: "1010502", name: "CRÉDITO TRIBUTARIO A FAVOR DE LA EMPRESA ( I. R.)" }, // if applicable
  total:    { code: "20103",   name: "CUENTAS Y DOCUMENTOS POR PAGAR" }, // your payable in screenshot
};

/** —— INCOME (Ventas / Clientes) —— */
export const PUCIncome: Record<"subtotal"|"iva"|"total", PUCAccount> = {
  // Adjust to your chart; examples:
  subtotal: { code: "70101",  name: "Ingresos por ventas locales" },     // put your real sales account here
  iva:      { code: "20201",  name: "IVA por pagar (débitos fiscales)" }, // your VAT payable
  total:    { code: "14301",  name: "Cuentas por cobrar comerciales locales" }, // your AR
};

/** Small lookup helpers for mapping names <-> codes */
export function makeLookups(accounts: {code: string; name: string}[]) {
  const codeToName = new Map<string, string>();
  const nameToCode = new Map<string, string>();
  for (const a of accounts) {
    codeToName.set(a.code, a.name);
    nameToCode.set(norm(a.name), a.code);
  }
  return { codeToName, nameToCode };
}

/** Best-effort resolve: code if present in label; else fuzzy by name */
export function resolveByNameOrLabel(
  nameOrLabel: string | undefined,
  accounts: { code: string; name: string }[]
): { code: string; name: string } | null {
  if (!nameOrLabel) return null;

  const m = nameOrLabel.trim().match(/^(\d{2,})\s*[—-]\s*/);
  if (m?.[1]) {
    const hit = accounts.find(a => a.code === m[1]);
    if (hit) return { code: hit.code, name: hit.name };
  }
  const { nameToCode, codeToName } = makeLookups(accounts);
  const code = nameToCode.get(norm(nameOrLabel));
  if (code) return { code, name: codeToName.get(code)! };

  // conservative contains match
  const hit = accounts.find(a => norm(a.name).includes(norm(nameOrLabel)));
  return hit ? { code: hit.code, name: hit.name } : null;
}