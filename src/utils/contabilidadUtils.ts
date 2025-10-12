import type { JournalEntry } from "../types/JournalEntry";

export function agruparCuentasPorTipo(entries: JournalEntry[]) {
  const agrupado: Record<"activo" | "pasivo" | "patrimonio", any[]> = {
    activo: [],
    pasivo: [],
    patrimonio: [],
  };

  const cuentas: Record<string, {
    codigo: string;
    nombre: string;
    debito: number;
    credito: number;
    saldo: number;
  }> = {};

  entries.forEach((e) => {
    if (!e.account_code || !e.account_name) return;

    if (!cuentas[e.account_code]) {
      cuentas[e.account_code] = {
        codigo: e.account_code,
        nombre: e.account_name,
        debito: 0,
        credito: 0,
        saldo: 0,
      };
    }
    cuentas[e.account_code].debito += e.debit || 0;
    cuentas[e.account_code].credito += e.credit || 0;
  });

  Object.values(cuentas).forEach((cuenta) => {
    cuenta.saldo = cuenta.debito - cuenta.credito;
    const tipo = tipoCuentaDesdeCodigo(cuenta.codigo);
    agrupado[tipo].push(cuenta);
  });

  return agrupado;
}

export function tipoCuentaDesdeCodigo(codigo: string | undefined): "activo" | "pasivo" | "patrimonio" {
  if (!codigo || typeof codigo !== "string") return "activo";
  if (codigo.startsWith("1")) return "activo";
  if (codigo.startsWith("2")) return "pasivo";
  if (codigo.startsWith("3")) return "patrimonio";
  return "activo";
}

export function formatearMonto(valor: number): string {
  return valor.toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}