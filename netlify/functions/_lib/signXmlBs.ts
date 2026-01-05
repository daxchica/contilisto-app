/**
 * Firma dummy SOLO para pruebas de flujo.
 * Mantiene el XML válido:
 * - Si existe declaración XML (<?xml ...?>), inserta el comentario DESPUÉS.
 * - Si no existe, agrega comentario al inicio.
 *
 * OJO: Esto NO es una firma XAdES real, solo sirve para probar el flujo
 * (generar XML -> "firmar" -> guardar -> enviar/recibir respuesta mock).
 */
export async function signXmlDummy(xml: string): Promise<string> {
  const normalized = String(xml ?? "").trim();
  if (!normalized) throw new Error("XML vacío");

  // Si hay declaración XML, no podemos poner nada antes de ella.
  const xmlDeclMatch = normalized.match(/^<\?xml[^>]*\?>/);

  const marker = `<!-- SIGNED (DUMMY) ${new Date().toISOString()} -->`;

  if (xmlDeclMatch) {
    const decl = xmlDeclMatch[0];
    const rest = normalized.slice(decl.length).trimStart();

    // Inserta comentario justo después de la declaración
    // y además un placeholder de ds:Signature para que el flujo sea parecido al real.
    return `${decl}\n${marker}\n${rest}`;
  }

  // Si no hay declaración, igual devolvemos XML con marcador al inicio.
  return `${marker}\n${normalized}`;
}