// ============================================================================
// src/components/sri/AtsPreviewModal.tsx
// CONTILISTO — ATS Preview Modal — Talón Resumen ATS
// ============================================================================

import React, { useMemo } from "react";
import type { AtsDocument } from "@/types/atsDocument";
import type { TaxLedgerEntry } from "@/types/TaxLedgerEntry";

/* =============================================================================
   TYPES
============================================================================= */

type Props = {
  open: boolean;
  documents: AtsDocument[];
  onClose: () => void;
  onExportXml: () => void;
  /** Optional ledger for computing retention sections */
  ledger?: TaxLedgerEntry[];
  entityId?: string;
  period?: string;
  entityName?: string;
  entityRuc?: string;
};

/* =============================================================================
   HELPERS
============================================================================= */

const fmt = (n?: number) =>
  new Intl.NumberFormat("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));

function n2(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  "01": "Factura",
  "02": "Nota de Venta",
  "03": "Liquidación de Compras",
  "04": "Nota de Crédito",
  "05": "Nota de Débito",
  "06": "Guía de Remisión",
  "07": "Comprobante de Retención",
  "18": "Documentos Autorizados en Ventas",
};

interface DocTypeRow {
  code: string;
  label: string;
  count: number;
  base0: number;
  base12: number;
  baseNoObjeto: number;
  iva: number;
}

interface RentaRetRow {
  code: string;
  label: string;
  count: number;
  base: number;
  retained: number;
}

interface IvaRetRow {
  operation: string;
  concept: string;
  retained: number;
}

interface ReceivedRow {
  operation: string;
  concept: string;
  retained: number;
}

function resolveRentaLabel(code: string): string {
  const labels: Record<string, string> = {
    "303": "Honorarios profesionales y demás pagos por servicios relacionados con el título",
    "304": "Servicios predomina la mano de obra",
    "307": "Servicios publicidad y comunicación",
    "309": "Arrendamiento bienes inmuebles",
    "310": "Seguros y reaseguros (primas y cesiones)",
    "312": "Transporte privado de pasajeros o servicio público o privado de carga",
    "319": "Arrendamiento mercantil",
    "320": "Arrendamiento bienes inmuebles a personas naturales",
    "322": "Seguros y cesiones (personas naturales)",
    "323": "Por pagos a no residentes — servicios ocasionales",
    "324": "Por pagos a no residentes — rendimientos financieros",
    "325": "Por pagos a no residentes — dividendos",
    "327": "Servicios entre sociedades",
    "328": "Servicios y honorarios — entre sociedades (10%)",
    "330": "Por rendimientos financieros pagados a naturales y sociedades (bancos)",
    "332": "Otras compras de bienes y servicios no sujetas a retención",
    "333": "Retención renta 1.75%",
    "334": "Retención renta 2%",
    "340": "Loterías, rifas, apuestas y similares",
    "341": "Venta de bienes muebles de naturaleza corporal",
    "344": "Retención renta 8%",
    "3440": "Otras retenciones aplicables el 2.75%",
    "345": "Retención renta 10%",
    "346": "Actividades de construcción de obra material inmueble, urbanización, lotización o actividades similares",
    "999": "Retención renta no clasificada",
  };
  return labels[code] ?? `Código ${code}`;
}

/* =============================================================================
   MAIN COMPONENT
============================================================================= */

export default function AtsPreviewModal({
  open,
  documents,
  onClose,
  onExportXml,
  ledger = [],
  entityId = "",
  period = "",
  entityName = "",
  entityRuc = "",
}: Props) {
  if (!open) return null;

  const printDate = new Date().toLocaleDateString("es-EC");
  const [y, m] = period ? period.split("-").map(Number) : [0, 0];
  const lastDay = y && m ? new Date(y, m, 0).getDate() : 31;
  const fromDate = period ? `${period}-01` : "";
  const toDate = period ? `${period}-${String(lastDay).padStart(2, "0")}` : "";

  // ── COMPRAS rows ──
  const comprasRows: DocTypeRow[] = useMemo(() => {
    const purchases = documents.filter((d) => d.type === "purchase");
    const map = new Map<string, DocTypeRow>();
    for (const d of purchases) {
      const code = d.documentType || "01";
      const label = DOC_TYPE_LABELS[code] ?? `Tipo ${code}`;
      if (!map.has(code)) map.set(code, { code, label, count: 0, base0: 0, base12: 0, baseNoObjeto: 0, iva: 0 });
      const row = map.get(code)!;
      row.count++;
      row.base0 = n2(row.base0 + (d.base0 ?? 0));
      row.base12 = n2(row.base12 + (d.base12 ?? 0));
      row.baseNoObjeto = n2(row.baseNoObjeto + (d.baseNoObjeto ?? 0));
      row.iva = n2(row.iva + (d.iva ?? 0));
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [documents]);

  // ── VENTAS rows ──
  const ventasRows: DocTypeRow[] = useMemo(() => {
    const sales = documents.filter((d) => d.type === "sale");
    const map = new Map<string, DocTypeRow>();
    for (const d of sales) {
      const code = d.documentType || "18";
      const label = DOC_TYPE_LABELS[code] ?? `Tipo ${code}`;
      if (!map.has(code)) map.set(code, { code, label, count: 0, base0: 0, base12: 0, baseNoObjeto: 0, iva: 0 });
      const row = map.get(code)!;
      row.count++;
      row.base0 = n2(row.base0 + (d.base0 ?? 0));
      row.base12 = n2(row.base12 + (d.base12 ?? 0));
      row.baseNoObjeto = n2(row.baseNoObjeto + (d.baseNoObjeto ?? 0));
      row.iva = n2(row.iva + (d.iva ?? 0));
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [documents]);

  // ── RENTA RETENTIONS (agente) from ledger ──
  const rentaRetRows: RentaRetRow[] = useMemo(() => {
    const map = new Map<string, RentaRetRow>();
    const relevantEntries = ledger.filter(
      (e) => e.entityId === entityId && e.period === period && n2(e.rentaRetentionPaid) > 0
    );
    for (const e of relevantEntries) {
      const rentaAmt = n2(e.rentaRetentionPaid);
      const base = n2(e.base12 || e.purchaseBase12 || e.base0 || e.purchaseBase0 || 0);
      const pct = base > 0 ? n2((rentaAmt / base) * 100) : 0;

      let code = "332";
      if (pct === 10) code = "303";
      else if (pct === 8) code = "344";
      else if (pct === 2.75) code = "3440";
      else if (pct === 2) code = "334";
      else if (pct === 1.75) code = "333";
      else if (pct === 1) code = "332";

      if (!map.has(code)) {
        map.set(code, { code, label: resolveRentaLabel(code), count: 0, base: 0, retained: 0 });
      }
      const row = map.get(code)!;
      row.count++;
      row.base = n2(row.base + base);
      row.retained = n2(row.retained + rentaAmt);
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [ledger, entityId, period]);

  // ── IVA RETENTIONS (agente) from ledger ──
  const ivaRetRows: IvaRetRow[] = useMemo(() => {
    const map = new Map<number, number>();
    const relevantEntries = ledger.filter(
      (e) => e.entityId === entityId && e.period === period && n2(e.ivaRetentionPaid) > 0
    );
    for (const e of relevantEntries) {
      const ivaAmt = n2(e.ivaRetentionPaid);
      const ivaBase = n2(e.iva || e.purchaseIva || 0);
      const pct = ivaBase > 0 ? n2((ivaAmt / ivaBase) * 100) : 0;
      map.set(pct, n2((map.get(pct) ?? 0) + ivaAmt));
    }

    const rows: IvaRetRow[] = [];
    const allPcts = [10, 20, 30, 50, 70, 100];
    for (const pct of allPcts) {
      if (map.has(pct)) {
        rows.push({
          operation: "COMPRA",
          concept: `Retencion IVA ${pct}%`,
          retained: map.get(pct)!,
        });
      }
    }
    // Any other percentages
    for (const [pct, amt] of Array.from(map.entries())) {
      if (!allPcts.includes(pct)) {
        rows.push({ operation: "COMPRA", concept: `Retención IVA ${pct}%`, retained: amt });
      }
    }
    return rows;
  }, [ledger, entityId, period]);

  // ── RETENCIONES RECIBIDAS (from clients) ──
  const receivedRows: ReceivedRow[] = useMemo(() => {
    let totalIvaReceived = 0;
    let totalRentaReceived = 0;
    for (const e of ledger) {
      if (e.entityId !== entityId || e.period !== period) continue;
      totalIvaReceived = n2(totalIvaReceived + n2(e.ivaRetentionReceived));
      totalRentaReceived = n2(totalRentaReceived + n2(e.rentaRetentionReceived));
    }
    const rows: ReceivedRow[] = [];
    if (totalIvaReceived > 0) {
      rows.push({ operation: "VENTA", concept: "Valor de IVA que le han retenido", retained: totalIvaReceived });
    }
    if (totalRentaReceived > 0) {
      rows.push({ operation: "VENTA", concept: "Valor de Renta que le han retenido", retained: totalRentaReceived });
    }
    return rows;
  }, [ledger, entityId, period]);

  // Totals
  const totCompras = {
    count: comprasRows.reduce((s, r) => s + r.count, 0),
    base0: n2(comprasRows.reduce((s, r) => s + r.base0, 0)),
    base12: n2(comprasRows.reduce((s, r) => s + r.base12, 0)),
    baseNoObjeto: n2(comprasRows.reduce((s, r) => s + r.baseNoObjeto, 0)),
    iva: n2(comprasRows.reduce((s, r) => s + r.iva, 0)),
  };
  const totVentas = {
    count: ventasRows.reduce((s, r) => s + r.count, 0),
    base0: n2(ventasRows.reduce((s, r) => s + r.base0, 0)),
    base12: n2(ventasRows.reduce((s, r) => s + r.base12, 0)),
    baseNoObjeto: n2(ventasRows.reduce((s, r) => s + r.baseNoObjeto, 0)),
    iva: n2(ventasRows.reduce((s, r) => s + r.iva, 0)),
  };
  const totRenta = {
    count: rentaRetRows.reduce((s, r) => s + r.count, 0),
    base: n2(rentaRetRows.reduce((s, r) => s + r.base, 0)),
    retained: n2(rentaRetRows.reduce((s, r) => s + r.retained, 0)),
  };
  const totIvaRet = n2(ivaRetRows.reduce((s, r) => s + r.retained, 0));
  const totReceived = n2(receivedRows.reduce((s, r) => s + r.retained, 0));

  /* ── TABLE helpers ── */
  const thBase = "border border-gray-300 px-2 py-1 bg-gray-100 font-semibold text-left whitespace-nowrap text-xs";
  const td = "border border-gray-300 px-2 py-1 text-xs";
  const tdR = "border border-gray-300 px-2 py-1 text-xs text-right";
  const tfootTd = "border border-gray-300 px-2 py-1 text-xs font-bold bg-gray-50";
  const tfootTdR = "border border-gray-300 px-2 py-1 text-xs font-bold bg-gray-50 text-right";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-[1100px] max-h-[90vh] overflow-auto rounded-xl shadow-lg p-6">

        {/* ══════════════════════════════════════════════ */}
        {/* HEADER                                        */}
        {/* ══════════════════════════════════════════════ */}
        <div className="text-center border-b pb-4 mb-5">
          {entityName && <p className="font-bold text-sm">{entityName} — {entityRuc}</p>}
          <p className="font-bold text-lg text-[#0A3558]">Talón Resumen ATS</p>
          {period && (
            <p className="text-sm text-gray-600">
              Desde: {fromDate} &nbsp; Hasta: {toDate}
            </p>
          )}
          <p className="text-sm text-gray-600">Fecha: {printDate}</p>
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* SECTION 1: COMPRAS                            */}
        {/* ══════════════════════════════════════════════ */}
        <div className="mb-6">
          <p className="font-bold text-sm text-[#0A3558] mb-2 uppercase tracking-wide">COMPRAS</p>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr>
                <th className={thBase}>Cod.</th>
                <th className={thBase}>Transacción</th>
                <th className={thBase + " text-right"}>No. Registros</th>
                <th className={thBase + " text-right"}>BI tarifa 0%</th>
                <th className={thBase + " text-right"}>BI tarifa diferente 0%</th>
                <th className={thBase + " text-right"}>BI No Objeto IVA</th>
                <th className={thBase + " text-right"}>Valor IVA</th>
              </tr>
            </thead>
            <tbody>
              {comprasRows.length === 0 ? (
                <tr>
                  <td className={td} colSpan={7}>Sin registros</td>
                </tr>
              ) : (
                comprasRows.map((r) => (
                  <tr key={r.code} className="hover:bg-gray-50">
                    <td className={td}>{r.code}</td>
                    <td className={td}>{r.label}</td>
                    <td className={tdR}>{r.count}</td>
                    <td className={tdR}>{fmt(r.base0)}</td>
                    <td className={tdR}>{fmt(r.base12)}</td>
                    <td className={tdR}>{fmt(r.baseNoObjeto)}</td>
                    <td className={tdR}>{fmt(r.iva)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className={tfootTd} colSpan={2}>TOTAL</td>
                <td className={tfootTdR}>{totCompras.count}</td>
                <td className={tfootTdR}>{fmt(totCompras.base0)}</td>
                <td className={tfootTdR}>{fmt(totCompras.base12)}</td>
                <td className={tfootTdR}>{fmt(totCompras.baseNoObjeto)}</td>
                <td className={tfootTdR}>{fmt(totCompras.iva)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* SECTION 2: VENTAS                             */}
        {/* ══════════════════════════════════════════════ */}
        <div className="mb-6">
          <p className="font-bold text-sm text-[#0A3558] mb-2 uppercase tracking-wide">VENTAS</p>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr>
                <th className={thBase}>Cod.</th>
                <th className={thBase}>Transacción</th>
                <th className={thBase + " text-right"}>No. Registros</th>
                <th className={thBase + " text-right"}>BI tarifa 0%</th>
                <th className={thBase + " text-right"}>BI tarifa diferente 0%</th>
                <th className={thBase + " text-right"}>BI No Objeto IVA</th>
                <th className={thBase + " text-right"}>Valor IVA</th>
              </tr>
            </thead>
            <tbody>
              {ventasRows.length === 0 ? (
                <tr>
                  <td className={td} colSpan={7}>Sin registros</td>
                </tr>
              ) : (
                ventasRows.map((r) => (
                  <tr key={r.code} className="hover:bg-gray-50">
                    <td className={td}>{r.code}</td>
                    <td className={td}>{r.label}</td>
                    <td className={tdR}>{r.count}</td>
                    <td className={tdR}>{fmt(r.base0)}</td>
                    <td className={tdR}>{fmt(r.base12)}</td>
                    <td className={tdR}>{fmt(r.baseNoObjeto)}</td>
                    <td className={tdR}>{fmt(r.iva)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className={tfootTd} colSpan={2}>TOTAL</td>
                <td className={tfootTdR}>{totVentas.count}</td>
                <td className={tfootTdR}>{fmt(totVentas.base0)}</td>
                <td className={tfootTdR}>{fmt(totVentas.base12)}</td>
                <td className={tfootTdR}>{fmt(totVentas.baseNoObjeto)}</td>
                <td className={tfootTdR}>{fmt(totVentas.iva)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* SECTION 3: RETENCIONES AGENTE                 */}
        {/* ══════════════════════════════════════════════ */}
        <div className="mb-6">
          <p className="font-bold text-sm text-[#0A3558] mb-2 uppercase tracking-wide">
            RESUMEN DE RETENCIONES — AGENTE DE RETENCIÓN
          </p>

          {/* 3a: RENTA */}
          <p className="font-semibold text-xs mb-1 text-gray-700">
            RETENCIÓN EN LA FUENTE DE IMPUESTO A LA RENTA
          </p>
          <table className="w-full border-collapse border border-gray-300 mb-4">
            <thead>
              <tr>
                <th className={thBase}>Cod.</th>
                <th className={thBase}>Concepto de Retención</th>
                <th className={thBase + " text-right"}>No. Registros</th>
                <th className={thBase + " text-right"}>Base Imponible</th>
                <th className={thBase + " text-right"}>Valor Retenido</th>
              </tr>
            </thead>
            <tbody>
              {rentaRetRows.length === 0 ? (
                <tr>
                  <td className={td} colSpan={5}>Sin retenciones de renta registradas</td>
                </tr>
              ) : (
                rentaRetRows.map((r) => (
                  <tr key={r.code} className="hover:bg-gray-50">
                    <td className={td}>{r.code}</td>
                    <td className={td}>{r.label}</td>
                    <td className={tdR}>{r.count}</td>
                    <td className={tdR}>{fmt(r.base)}</td>
                    <td className={tdR}>{fmt(r.retained)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className={tfootTd} colSpan={3}>TOTAL</td>
                <td className={tfootTdR}>{fmt(totRenta.base)}</td>
                <td className={tfootTdR}>{fmt(totRenta.retained)}</td>
              </tr>
            </tfoot>
          </table>

          {/* 3b: IVA */}
          <p className="font-semibold text-xs mb-1 text-gray-700">
            RETENCIÓN EN LA FUENTE DE IVA
          </p>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr>
                <th className={thBase}>Operación</th>
                <th className={thBase}>Concepto de Retención</th>
                <th className={thBase + " text-right"}>Valor Retenido</th>
              </tr>
            </thead>
            <tbody>
              {ivaRetRows.length === 0 ? (
                <tr>
                  <td className={td} colSpan={3}>Sin retenciones IVA registradas</td>
                </tr>
              ) : (
                ivaRetRows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className={td}>{r.operation}</td>
                    <td className={td}>{r.concept}</td>
                    <td className={tdR}>{fmt(r.retained)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className={tfootTd} colSpan={2}>TOTAL</td>
                <td className={tfootTdR}>{fmt(totIvaRet)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* SECTION 4: RETENCIONES RECIBIDAS              */}
        {/* ══════════════════════════════════════════════ */}
        <div className="mb-6">
          <p className="font-bold text-sm text-[#0A3558] mb-2 uppercase tracking-wide">
            RESUMEN DE RETENCIONES QUE LE EFECTUARON
          </p>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr>
                <th className={thBase}>Operación</th>
                <th className={thBase}>Concepto de Retención</th>
                <th className={thBase + " text-right"}>Valor Retenido</th>
              </tr>
            </thead>
            <tbody>
              {receivedRows.length === 0 ? (
                <tr>
                  <td className={td} colSpan={3}>Sin retenciones recibidas registradas</td>
                </tr>
              ) : (
                receivedRows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className={td}>{r.operation}</td>
                    <td className={td}>{r.concept}</td>
                    <td className={tdR}>{fmt(r.retained)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className={tfootTd} colSpan={2}>TOTAL</td>
                <td className={tfootTdR}>{fmt(totReceived)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* SIGNATURE AREA                                */}
        {/* ══════════════════════════════════════════════ */}
        <div className="mt-8 flex justify-around text-xs text-gray-600 border-t pt-4">
          <div className="text-center">
            <div className="w-40 border-t border-gray-400 mt-8 mx-auto"></div>
            <p>Firma Responsable</p>
          </div>
          <div className="text-center">
            <div className="w-40 border-t border-gray-400 mt-8 mx-auto"></div>
            <p>Contador</p>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-50 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={onExportXml}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Exportar XML
          </button>
        </div>

      </div>
    </div>
  );
}
