// utils/normalizeInvoiceNumber.ts
export function normalizeInvoiceNumber(value?: string) {
  return (value || "")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .trim();
}