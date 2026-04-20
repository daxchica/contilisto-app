// ============================================================================
// src/services/sri/generateIva104.ts
// CONTILISTO — IVA 104 Generator (FIXED + TRACEABLE)
// ============================================================================

import { mapJournalToTaxDocuments } from "@/services/sri/mapJournalToTaxDocements";
import type { JournalEntry } from "@/types/JournalEntry";

export async function generateIva104(
  entries: JournalEntry[],
  entityId: string,
  period: string
) {
  // =========================
  // MAP TO TAX DOCUMENTS
  // =========================
  const docs = mapJournalToTaxDocuments(entries);

  // =========================
  // CALCULATE SUMMARY
  // =========================
  let ventas12 = 0;
  let compras12 = 0;
  let ivaVentas = 0;
  let ivaCompras = 0;
  let retenciones = 0;

  for (const d of docs) {
    if (d.type === "sale") {
      ventas12 += d.base12;
      ivaVentas += d.ivaVentas;
    }

    if (d.type === "purchase") {
      compras12 += d.base12;
      ivaCompras += d.ivaCompras;
      retenciones += d.ivaRetention;
    }
  }

  const credito = ivaCompras + retenciones;
  const ivaPagar = ivaVentas - credito;

  // =========================
  // DEBUG (REMOVE LATER)
  // =========================
  console.log("🧾 IVA DOCS:", docs);
  console.log("📊 IVA SUMMARY:", {
    ventas12,
    compras12,
    ivaVentas,
    ivaCompras,
    retenciones,
    ivaPagar,
  });

  // =========================
  // RETURN FULL STRUCTURE
  // =========================
  return {
    ventas12,
    compras12,
    ivaVentas,
    ivaCompras,
    retenciones,
    ivaPagar,
    documents: docs, // 🔥 CRITICAL FOR TABLE
  };
}