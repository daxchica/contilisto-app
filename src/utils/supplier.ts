import type { Payable } from "@/types/Payable";

const norm = (v?: string) => (v || "").trim();

export function resolveSupplierName(p: Payable): string {
  return (
    norm(p.supplierName) ||
    "PROVEEDOR"
  );
}

export function resolveSupplierRUC(p: Payable): string | null {
  const ruc = norm(p.supplierRUC);
  return ruc || null;
}