/**
 * normalizeConcept
 * -----------------
 * Converts noisy OCR invoice concepts into a stable semantic key.
 * This is CRITICAL for contextual account learning accuracy.
 *
 * Rules:
 * - lowercase
 * - remove accents
 * - remove punctuation
 * - remove numbers
 * - collapse whitespace
 * - apply Ecuador-specific keyword normalization
 */

export function normalizeConcept(raw?: string): string {
  if (!raw) return "";

  let s = raw.toLowerCase();

  // ------------------------------------------------------------------
  // 1. Remove accents (áéíóúñ → aeioun)
  // ------------------------------------------------------------------
  s = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // ------------------------------------------------------------------
  // 2. Remove numbers & punctuation
  // ------------------------------------------------------------------
  s = s
    .replace(/[0-9]/g, " ")
    .replace(/[^a-z\s]/g, " ");

  // ------------------------------------------------------------------
  // 3. Normalize whitespace
  // ------------------------------------------------------------------
  s = s.replace(/\s+/g, " ").trim();

  // ------------------------------------------------------------------
  // 4. Ecuador-specific semantic normalization
  // IMPORTANT: order matters (specific → general)
  // ------------------------------------------------------------------

  // --- COMBUSTIBLES ---
  if (
    s.includes("diesel") ||
    s.includes("gasolina") ||
    s.includes("combustible") ||
    s.includes("extra") ||
    s.includes("super")
  ) {
    return "combustible";
  }

  // --- SEGUROS ---
  if (
    s.includes("seguro") ||
    s.includes("poliza") ||
    s.includes("aseguradora")
  ) {
    return "seguro";
  }

  // --- ALIMENTACIÓN ---
  if (
    s.includes("alimentacion") ||
    s.includes("comida") ||
    s.includes("restaurant") ||
    s.includes("restaurante") ||
    s.includes("catering")
  ) {
    return "alimentacion";
  }

  // --- VESTUARIO / UNIFORMES ---
  if (
    s.includes("uniforme") ||
    s.includes("vestuario") ||
    s.includes("ropa") ||
    s.includes("indumentaria")
  ) {
    return "vestuario";
  }

  // --- TRANSPORTE / MOVILIZACIÓN ---
  if (
    s.includes("transporte") ||
    s.includes("movilizacion") ||
    s.includes("movilizacion") ||
    s.includes("pasaje") ||
    s.includes("taxi") ||
    s.includes("flete")
  ) {
    return "transporte";
  }

  // --- MANTENIMIENTO ---
  if (
    s.includes("mantenimiento") ||
    s.includes("reparacion") ||
    s.includes("repuesto") ||
    s.includes("taller")
  ) {
    return "mantenimiento";
  }

  // --- SERVICIOS BÁSICOS ---
  if (
    s.includes("energia") ||
    s.includes("electricidad") ||
    s.includes("agua") ||
    s.includes("telefonia") ||
    s.includes("internet")
  ) {
    return "servicios basicos";
  }

  // --- DEFAULT FALLBACK ---
  // Use first 3 meaningful words to avoid overfitting
  const words = s.split(" ").filter(w => w.length >= 3);
  return words.slice(0, 3).join(" ");
}