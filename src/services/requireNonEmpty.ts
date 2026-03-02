export function requireNonEmpty(value: unknown, label: string): void {
  const str = typeof value === "string" ? value : String(value ?? "");
  if (!str.trim()) {
    throw new Error(`${label} requerido`);
  }
}
