export function requireEntityId(entityId: string, context?: string): void {
  if (typeof entityId !== "string" || !entityId.trim()) {
    const suffix = context ? ` para ${context}` : "";
    throw new Error(`entityId requerido${suffix}`);
  }
}
