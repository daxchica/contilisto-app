// src/services/extractInvoiceFromLayoutAPI.ts

import type { JournalEntry } from "../types/JournalEntry";
import type { TextBlock } from "../types/TextBlock";
import { normalizeEntry, canonicalPair } from "../utils/accountPUCMap";

/**
 * Filtra solo los bloques relevantes visualmente para minimizar tokens
 */
function filterRelevantBlocks(blocks: TextBlock[]): TextBlock[] {
  return blocks.filter((b) =>
    /ruc|factura|autorizaci[oó]n|subtotal|iva|total|proveedor|cliente|forma de pago|efectivo|transferencia|valor total/i.test(
      b.text.toLowerCase()
    )
  );
}

/**
 * 🔍 Busca el número a la derecha del texto dado (basado en coordenadas)
 */
function findNumericRightOf(blocks: TextBlock[], label: string): number | null {
  const target = blocks.find((b) =>
    b.text.toUpperCase().includes(label.toUpperCase())
  );
  if (!target) return null;

  const sameRow = blocks.filter(
    (b) => Math.abs(b.y - target.y) < 5 && b.x > target.x
  );

  const nums = sameRow
    .map((b) =>
      parseFloat(b.text.replace(/[^\d.,-]/g, "").replace(",", "."))
    )
    .filter((n) => !isNaN(n) && n > 0 && n < 100000);

  return nums.length ? Math.max(...nums) : null;
}

/**
 * Llama al endpoint de Netlify Function para procesar facturas usando LayoutAI.
 */
export async function extractInvoiceFromLayoutAPI(
  blocks: TextBlock[],
  entityRUC: string,
  entityType: string,
): Promise<JournalEntry[]> {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const filtered = filterRelevantBlocks(blocks);

    const response = await fetch("/.netlify/functions/extract-invoice-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks, userRUC: entityRUC, entityType }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const parsed = await response.json();
    console.log("Respuesta LayoutAI:", parsed);

    if (Array.isArray(parsed) && parsed.length > 0) {
      const rawEntries = parsed
        .map((r) => coerceLayoutEntry(r, "expense", today, entityRUC))
        .filter((e): e is JournalEntry => e !== null);

      if (rawEntries.some((e) => e.account_code === "1030201")) {
        return rawEntries.map(normalizeEntry);
      }

      console.warn("LayoutAI sin IVA detectado - aplicando deteccion visual local...");
    }

    // === Paso 3: detección local basada en layout (respaldo de precisión) ===
    const subtotal15 =
      findNumericRightOf(filtered, "SUBTOTAL 15") ??
      findNumericRightOf(filtered, "SUBTOTAL 12") ??
      0;

    const subtotal0 =
      findNumericRightOf(filtered, "SUBTOTAL 0") ??
      findNumericRightOf(filtered, "SUBTOTAL 0%") ??
      0;

    const iva =
      findNumericRightOf(filtered, "IVA 15") ??
      findNumericRightOf(filtered, "IVA 12") ??
      findNumericRightOf(filtered, "IVA") ??
      0;

    const total =
      findNumericRightOf(filtered, "VALOR TOTAL") ??
      findNumericRightOf(filtered, "TOTAL") ??
      0;

    const subtotalBase =
      subtotal15 + subtotal0 || (total > 0 && iva > 0 ? total - iva : 0);

    console.log("🧠 Layout precision fallback:", {
      subtotal15,
      subtotal0,
      iva,
      subtotalBase,
      total,
    });

    // === Paso 4: construir asiento contable de respaldo ===
    const entries: JournalEntry[] = [];

    if (subtotalBase > 0) {
      entries.push({
        date: today,
        description: "Compra local – Gasto general",
        account_code: "5020128",
        account_name: "OTROS GASTOS",
        debit: subtotalBase,
        credit: undefined,
        type: "expense",
        invoice_number: "",
        source: "ai-layout",
        isManual: false,
        userId: "",
        entityId: "",
        createdAt: Date.now(),
      });
    }

    if (iva > 0.01) {
      entries.push({
        date: today,
        description: "IVA en compras",
        account_code: "1030201",
        account_name: "IVA EN COMPRAS",
        debit: iva,
        credit: undefined,
        type: "expense",
        invoice_number: "",
        source: "ai-layout",
        isManual: false,
        userId: "",
        entityId: "",
        createdAt: Date.now(),
      });
    }

    const totalToUse = total > 0 ? total : subtotalBase + iva;
    if (totalToUse > 0) {
      entries.push({
        date: today,
        description: "Cuenta por pagar proveedor",
        account_code: "201030102",
        account_name: "PROVEEDORES",
        debit: undefined,
        credit: totalToUse,
        type: "expense",
        invoice_number: "",
        source: "ai-layout",
        isManual: false,
        userId: "",
        entityId: "",
        createdAt: Date.now(),
      });
    }

    return entries.map(normalizeEntry);
  } catch (err) {
    console.error("❌ Error calling extract-invoice-layout:", err);
    return [];
  }
}

/**
 * Convierte un valor genérico en número decimal con dos decimales si es válido.
 */
function toNum(x: any): number | undefined {
  const n = typeof x === "string" ? parseFloat(x) : x;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}

/**
 * Transforma una respuesta bruta de la API visual en un JournalEntry tipado.
 */
function coerceLayoutEntry(
  r: any,
  fallbackType: "expense" | "income",
  fallbackDate: string,
  entityRUC: string
): JournalEntry | null {
  const debit = toNum(r?.debit);
  const credit = toNum(r?.credit);
  if (!debit && !credit) return null;

  const description = String(r?.description ?? "").slice(0, 300);
  const rawCode = String(r?.account_code ?? "");
  const rawName = String(r?.account_name ?? "");
  const date = typeof r?.date === "string" ? r.date.slice(0, 10) : fallbackDate;
  const pair = canonicalPair({ code: rawCode, name: rawName });

  const tipoDetectado: "expense" | "income" =
    r?.type === "expense" || r?.type === "income"
      ? r.type
      : r?.issuerRUC && r?.issuerRUC !== entityRUC
      ? "expense"
      : "income";

  return {
    id: crypto.randomUUID(),
    date,
    description,
    account_code: (pair as any).code || "",
    account_name: (pair as any).name || "",
    debit:
      debit && !credit 
      ? debit 
      : debit && credit && debit >= credit 
      ? debit 
      : undefined,
    credit: 
      credit && !debit 
      ? credit 
      : debit && credit && credit > debit 
      ? credit 
      : undefined,
    type: tipoDetectado,
    invoice_number: r?.invoice_number ? String(r.invoice_number) : "",
    source: "ai-layout",
    isManual: false,
    userId: "",
    entityId: "",
    createdAt: Date.now(),
  };
}