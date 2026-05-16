// ============================================================================
// src/components/modals/RetentionXmlPreviewModal.tsx
// CONTILISTO — Preview a parsed SRI comprobante de retención XML
//
// Shows retention details grouped by invoice, resolves each invoice to an
// existing payable, and lets the user save the retention record linked to it.
// ============================================================================

import React, { useEffect, useState } from "react";
import { serverTimestamp } from "firebase/firestore";
import type { SriRetXmlResult, SriRetTaxLine } from "@/utils/parseSriRetXml";
import { saveRetention, findPayableByInvoiceNumber } from "@/services/retentionsService";
import type { Payable } from "@/types/Payable";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const USD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function taxLabel(taxCode: string): string {
  if (taxCode === "1") return "Renta";
  if (taxCode === "2") return "IVA";
  if (taxCode === "6") return "ISD";
  return taxCode;
}

/** Group retention lines by the invoice they apply to */
function groupByInvoice(
  lines: SriRetTaxLine[]
): Map<string, SriRetTaxLine[]> {
  const map = new Map<string, SriRetTaxLine[]>();
  for (const l of lines) {
    const key = l.invoiceNumber || "SIN FACTURA";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(l);
  }
  return map;
}

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface LinkedPayable {
  invoiceNumber: string;
  payable: Payable | null;
  loading: boolean;
}

interface Props {
  open: boolean;
  retention: SriRetXmlResult;
  entityId: string;
  userIdSafe: string;
  onClose: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------

export default function RetentionXmlPreviewModal({
  open,
  retention,
  entityId,
  userIdSafe,
  onClose,
  onSaved,
}: Props) {
  const [linked, setLinked] = useState<LinkedPayable[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const invoiceGroups = groupByInvoice(retention.retentions);
  const invoiceNumbers = Array.from(invoiceGroups.keys());

  // ── Resolve payables for each invoice number ──────────────────────────────
  useEffect(() => {
    if (!open || !entityId) return;
    setSaved(false);
    setError("");

    const initial: LinkedPayable[] = invoiceNumbers.map((inv) => ({
      invoiceNumber: inv,
      payable: null,
      loading: true,
    }));
    setLinked(initial);

    invoiceNumbers.forEach((inv, i) => {
      findPayableByInvoiceNumber(entityId, inv)
        .then((payable) => {
          setLinked((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], payable, loading: false };
            return next;
          });
        })
        .catch(() => {
          setLinked((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], loading: false };
            return next;
          });
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entityId]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      // Build one retention record per invoice group
      for (const lp of linked) {
        const lines = invoiceGroups.get(lp.invoiceNumber) ?? [];
        const rentaLines = lines.filter((l) => l.taxCode === "1");
        const ivaLines   = lines.filter((l) => l.taxCode === "2");

        const totalRenta = +rentaLines.reduce((s, l) => s + l.retainedAmount, 0).toFixed(2);
        const totalIVA   = +ivaLines.reduce((s, l)   => s + l.retainedAmount, 0).toFixed(2);

        await saveRetention(entityId, {
          // Authorization
          accessKey:    retention.accessKey,
          certNumber:   retention.certNumber,
          authDate:     retention.authDate,
          issueDate:    retention.issueDate,
          // Parties
          issuerRUC:    retention.issuerRUC,
          issuerName:   retention.issuerName,
          supplierRUC:  retention.supplierRUC,
          supplierName: retention.supplierName,
          // Invoice link
          invoiceNumber:  lp.invoiceNumber,
          payableId:      lp.payable?.id ?? null,
          payableTransactionId: lp.payable?.transactionId ?? null,
          // Amounts
          totalRenta,
          totalIVA,
          totalRetained: +(totalRenta + totalIVA).toFixed(2),
          // Full tax lines for audit
          taxLines: lines.map((l) => ({
            taxCode:        l.taxCode,
            retentionCode:  l.retentionCode,
            baseAmount:     l.baseAmount,
            percentage:     l.percentage,
            retainedAmount: l.retainedAmount,
            docType:        l.docType,
            invoiceDate:    l.invoiceDate,
          })),
          // Source
          source:    "xml",
          createdBy: userIdSafe,
          createdAt: serverTimestamp(),
        });
      }

      setSaved(true);
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? "Error al guardar la retención");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-start justify-between rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-[#0A3558]">
              🧾 Comprobante de Retención
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {retention.certNumber} · {retention.issueDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none mt-0.5"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-600 font-medium mb-1">Agente de Retención</p>
              <p className="font-semibold text-gray-800">{retention.issuerName}</p>
              <p className="text-gray-500 text-xs">{retention.issuerRUC}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 font-medium mb-1">Sujeto Retenido</p>
              <p className="font-semibold text-gray-800">{retention.supplierName}</p>
              <p className="text-gray-500 text-xs">{retention.supplierRUC}</p>
            </div>
          </div>

          {/* Per-invoice groups */}
          {invoiceNumbers.map((invNum, i) => {
            const lines = invoiceGroups.get(invNum)!;
            const lp    = linked[i];
            const total = +lines.reduce((s, l) => s + l.retainedAmount, 0).toFixed(2);

            return (
              <div key={invNum} className="border rounded-xl overflow-hidden">
                {/* Invoice header */}
                <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b">
                  <div>
                    <span className="text-xs text-gray-500 font-medium">Factura</span>
                    <span className="ml-2 font-semibold text-gray-800 text-sm">{invNum}</span>
                    <span className="ml-2 text-xs text-gray-400">{lines[0]?.invoiceDate}</span>
                  </div>
                  {/* Payable link status */}
                  {lp?.loading ? (
                    <span className="text-xs text-gray-400 animate-pulse">Buscando CxP…</span>
                  ) : lp?.payable ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      ✓ Vinculada a CxP
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      ⚠ Factura no encontrada en CxP
                    </span>
                  )}
                </div>

                {/* Payable detail */}
                {lp?.payable && (
                  <div className="px-4 py-2 bg-green-50 border-b text-xs text-green-800">
                    Proveedor: <strong>{lp.payable.supplierName}</strong> ·
                    Saldo: <strong>{USD(lp.payable.balance)}</strong> ·
                    Estado: <strong>{lp.payable.status}</strong>
                  </div>
                )}

                {/* Tax lines */}
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b text-gray-400">
                      <th className="px-4 py-2 text-left font-medium">Tipo</th>
                      <th className="px-4 py-2 text-left font-medium">Cód.</th>
                      <th className="px-4 py-2 text-right font-medium">Base</th>
                      <th className="px-4 py-2 text-right font-medium">%</th>
                      <th className="px-4 py-2 text-right font-medium">Retenido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lines.map((l, j) => (
                      <tr key={j}>
                        <td className="px-4 py-2 text-gray-700">{taxLabel(l.taxCode)}</td>
                        <td className="px-4 py-2 text-gray-600">{l.retentionCode}</td>
                        <td className="px-4 py-2 text-right text-gray-700 tabular-nums">{USD(l.baseAmount)}</td>
                        <td className="px-4 py-2 text-right text-gray-700 tabular-nums">{l.percentage}%</td>
                        <td className="px-4 py-2 text-right font-semibold text-red-600 tabular-nums">{USD(l.retainedAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-gray-50">
                      <td colSpan={4} className="px-4 py-2 text-right text-xs text-gray-500 font-medium">
                        Total retenido esta factura
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-red-700 tabular-nums">
                        {USD(total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}

          {/* Grand total */}
          <div className="flex justify-between items-center bg-[#0A3558] text-white rounded-xl px-5 py-3">
            <div className="space-y-0.5">
              <div className="text-xs text-blue-200">
                Renta: {USD(retention.totalRenta)} · IVA: {USD(retention.totalIVA)}
              </div>
              <div className="font-semibold text-sm">Total retenido</div>
            </div>
            <div className="text-xl font-bold tabular-nums">
              {USD(retention.totalRetained)}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
          )}

          {/* Success */}
          {saved && (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="font-semibold text-green-700">Retención guardada exitosamente</p>
            </div>
          )}

          {/* Actions */}
          {!saved && (
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold bg-[#0A3558] text-white rounded-lg hover:bg-[#0d4a75] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Guardando…" : "💾 Guardar retención"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
