// ============================================================================
// CONTILISTO — IVA 104 ENGINE (CORRECT + TRACEABLE)
// ============================================================================

import type { JournalEntry } from "@/types/JournalEntry";
import { mapJournalToTaxDocuments } from "@/services/sri/mapJournalToTaxDocements";

export function buildIva104(entries: JournalEntry[]) {
  const docs = mapJournalToTaxDocuments(entries);

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

  return {
    ventas12,
    compras12,
    ivaVentas,
    ivaCompras,
    retenciones,
    ivaPagar,
    documents: docs, // 🔥 THIS ENABLES DETAIL VIEW
  };
console.log("IVA SUMMARY:", {
  ventas12,
  compras12,
  ivaVentas,
  ivaCompras,
  retenciones,
  ivaPagar,
  documents: docs,
});
  
}