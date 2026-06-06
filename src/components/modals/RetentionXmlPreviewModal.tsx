// ============================================================================
// src/components/modals/RetentionXmlPreviewModal.tsx
// CONTILISTO — Preview a parsed SRI comprobante de retención XML
//
// Handles TWO directions:
//
//  AP side  (retention PAID by us to supplier):
//    — The cert was issued BY us.  Links to a Payable.  No journal entry
//      is created here; the entry was created when registering the AP payment.
//
//  AR side  (retention RECEIVED from customer):
//    — The cert was issued BY our customer TO us.  Links to a Receivable.
//    — Creates proper journal entries:
//        DR  Retención IR por recuperar  (1130201)
//        DR  Retención IVA por recuperar (1130202)
//        CR  Cuentas por Cobrar          (receivable.account_code)
//    — Calls applyReceivablePayment() to reduce the AR balance.
// ============================================================================

import React, { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { serverTimestamp } from "firebase/firestore";

import type { SriRetXmlResult, SriRetTaxLine } from "@/utils/parseSriRetXml";
import type { Payable } from "@/types/Payable";
import type { Receivable } from "@/types/Receivable";
import type { JournalEntry } from "@/types/JournalEntry";

import { saveRetention, findPayableByInvoiceNumber } from "@/services/retentionsService";
import { findReceivableByInvoiceNumber, applyReceivablePayment } from "@/services/receivablesService";
import { saveJournalEntries } from "@/services/journalService";

// ── helpers ──────────────────────────────────────────────────────────────────

const USD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const n2 = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

function taxLabel(taxCode: string): string {
  if (taxCode === "1") return "Renta";
  if (taxCode === "2") return "IVA";
  if (taxCode === "6") return "ISD";
  return taxCode;
}

function groupByInvoice(lines: SriRetTaxLine[]): Map<string, SriRetTaxLine[]> {
  const map = new Map<string, SriRetTaxLine[]>();
  for (const l of lines) {
    const key = l.invoiceNumber || "SIN FACTURA";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(l);
  }
  return map;
}

// ── types ────────────────────────────────────────────────────────────────────

interface LinkedDoc {
  invoiceNumber: string;
  payable:    Payable    | null;
  receivable: Receivable | null;
  loading: boolean;
}

interface Props {
  open: boolean;
  retention: SriRetXmlResult;
  entityId: string;
  userIdSafe: string;
  /** RUC of the current entity (used to detect direction: paid vs received) */
  entityRUC?: string;
  onClose: () => void;
  onSaved: () => void;
}

// ── component ────────────────────────────────────────────────────────────────

export default function RetentionXmlPreviewModal({
  open,
  retention,
  entityId,
  userIdSafe,
  entityRUC,
  onClose,
  onSaved,
}: Props) {

  const [linked,  setLinked]  = useState<LinkedDoc[]>([]);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  const invoiceGroups   = groupByInvoice(retention.retentions);
  const invoiceNumbers  = Array.from(invoiceGroups.keys());

  // ── Detect direction ──────────────────────────────────────────────────────
  // The retention cert identifies:
  //   retention.issuerRUC   = who issued / signed the cert (the withholding agent)
  //   retention.supplierRUC = the party whose tax was withheld
  //
  // "Received" means OUR entity is the supplier being withheld — the customer
  // issued this cert to us.
  const isReceived = !!(
    entityRUC &&
    retention.supplierRUC &&
    retention.supplierRUC.trim() === entityRUC.trim()
  );

  // If entityRUC not provided, fall back to a heuristic: if issuer matches an
  // existing payable but NOT a receivable, it's AP; otherwise assume AR.
  const direction = isReceived ? "received" : "paid";

  // ── Load linked documents ─────────────────────────────────────────────────

  useEffect(() => {
    if (!open || !entityId) return;
    setSaved(false);
    setError("");

    const initial: LinkedDoc[] = invoiceNumbers.map((inv) => ({
      invoiceNumber: inv,
      payable:    null,
      receivable: null,
      loading: true,
    }));
    setLinked(initial);

    invoiceNumbers.forEach((inv, i) => {
      Promise.all([
        findPayableByInvoiceNumber(entityId, inv).catch(() => null),
        findReceivableByInvoiceNumber(entityId, inv).catch(() => null),
      ]).then(([payable, receivable]) => {
        setLinked((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], payable, receivable, loading: false };
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
      for (const lp of linked) {
        const lines      = invoiceGroups.get(lp.invoiceNumber) ?? [];
        const rentaLines = lines.filter((l) => l.taxCode === "1");
        const ivaLines   = lines.filter((l) => l.taxCode === "2");

        const totalRenta = n2(rentaLines.reduce((s, l) => s + n2(l.retainedAmount), 0));
        const totalIVA   = n2(ivaLines.reduce((s, l)   => s + n2(l.retainedAmount), 0));
        const totalRetained = n2(totalRenta + totalIVA);

        // ── AR side: received retention → create journal entries ────────────
        if (direction === "received" && lp.receivable) {
          const rec = lp.receivable;
          const tx  = uuidv4();
          const entries: JournalEntry[] = [];

          const base: Omit<JournalEntry, "account_code" | "account_name" | "debit" | "credit" | "description"> = {
            entityId,
            uid: userIdSafe,
            transactionId: tx,
            date: retention.issueDate || retention.authDate,
            transactionType: "payment",
            documentNature:  "sale",
            invoice_number:  lp.invoiceNumber,
            customer_ruc:    retention.issuerRUC,
            customer_name:   retention.issuerName,
          };

          // DR  Retención IR por recuperar
          if (totalRenta > 0) {
            entries.push({
              ...base,
              account_code: "1130201",
              account_name: "Retención IR por recuperar",
              debit:  totalRenta,
              credit: 0,
              description: `Ret. IR ${retention.certNumber} — fact. ${lp.invoiceNumber}`,
              tax: {
                retenciones: rentaLines.map((l) => ({
                  taxType:    "RENTA" as const,
                  code:       l.retentionCode,
                  percentage: n2(l.percentage),
                  base:       n2(l.baseAmount),
                  amount:     n2(l.retainedAmount),
                })),
              },
            });
          }

          // DR  Retención IVA por recuperar
          if (totalIVA > 0) {
            entries.push({
              ...base,
              account_code: "1130202",
              account_name: "Retención IVA por recuperar",
              debit:  totalIVA,
              credit: 0,
              description: `Ret. IVA ${retention.certNumber} — fact. ${lp.invoiceNumber}`,
              tax: {
                retenciones: ivaLines.map((l) => ({
                  taxType:    "IVA" as const,
                  code:       l.retentionCode,
                  percentage: n2(l.percentage),
                  base:       n2(l.baseAmount),
                  amount:     n2(l.retainedAmount),
                })),
              },
            });
          }

          // CR  Cuentas por Cobrar (cancels / reduces the receivable)
          if (totalRetained > 0) {
            entries.push({
              ...base,
              account_code: rec.account_code,
              account_name: rec.account_name,
              debit:  0,
              credit: totalRetained,
              description: `Cobro ret. ${retention.certNumber} — fact. ${lp.invoiceNumber}`,
            });
          }

          // Persist journal entries
          if (entries.length > 0) {
            await saveJournalEntries(entityId, userIdSafe, entries);
            // Update receivable balance
            await applyReceivablePayment(entityId, rec, totalRetained, userIdSafe, tx);
          }
        }

        // ── Save retention record (both directions) ─────────────────────────
        await saveRetention(entityId, {
          direction,
          accessKey:    retention.accessKey,
          certNumber:   retention.certNumber,
          authDate:     retention.authDate,
          issueDate:    retention.issueDate,
          issuerRUC:    retention.issuerRUC,
          issuerName:   retention.issuerName,
          supplierRUC:  retention.supplierRUC,
          supplierName: retention.supplierName,
          invoiceNumber:  lp.invoiceNumber,
          payableId:      lp.payable?.id   ?? null,
          receivableId:   lp.receivable?.id ?? null,
          totalRenta,
          totalIVA,
          totalRetained,
          taxLines: lines.map((l) => ({
            taxCode:        l.taxCode,
            retentionCode:  l.retentionCode,
            baseAmount:     l.baseAmount,
            percentage:     l.percentage,
            retainedAmount: l.retainedAmount,
            docType:        l.docType,
            invoiceDate:    l.invoiceDate,
          })),
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

  // ── UI ────────────────────────────────────────────────────────────────────

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
          {/* Direction badge */}
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              direction === "received"
                ? "bg-green-100 text-green-700"
                : "bg-blue-100 text-blue-700"
            }`}>
              {direction === "received" ? "📥 Retención recibida" : "📤 Retención emitida"}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">

          {/* Direction explanation */}
          {direction === "received" && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <p className="font-semibold">Retención recibida del cliente</p>
              <p className="text-xs mt-0.5 text-green-700">
                Al confirmar se registrará el asiento:
                <strong> DR Ret. IR/IVA por recuperar → CR Cuentas por Cobrar</strong>,
                y se reducirá el saldo pendiente de cobro.
              </p>
            </div>
          )}

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-600 font-medium mb-1">Agente de Retención (Cliente)</p>
              <p className="font-semibold text-gray-800">{retention.issuerName}</p>
              <p className="text-gray-500 text-xs">{retention.issuerRUC}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 font-medium mb-1">Sujeto Retenido (Nuestra empresa)</p>
              <p className="font-semibold text-gray-800">{retention.supplierName}</p>
              <p className="text-gray-500 text-xs">{retention.supplierRUC}</p>
            </div>
          </div>

          {/* Per-invoice groups */}
          {invoiceNumbers.map((invNum, i) => {
            const lines = invoiceGroups.get(invNum)!;
            const lp    = linked[i];
            const total = n2(lines.reduce((s, l) => s + n2(l.retainedAmount), 0));
            const rec   = lp?.receivable;
            const pay   = lp?.payable;

            return (
              <div key={invNum} className="border rounded-xl overflow-hidden">
                {/* Invoice header */}
                <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b">
                  <div>
                    <span className="text-xs text-gray-500 font-medium">Factura</span>
                    <span className="ml-2 font-semibold text-gray-800 text-sm">{invNum}</span>
                    <span className="ml-2 text-xs text-gray-400">{lines[0]?.invoiceDate}</span>
                  </div>
                  {lp?.loading ? (
                    <span className="text-xs text-gray-400 animate-pulse">Buscando…</span>
                  ) : rec ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      ✓ Vinculada a CxC
                    </span>
                  ) : pay ? (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      ✓ Vinculada a CxP
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      ⚠ Factura no encontrada
                    </span>
                  )}
                </div>

                {/* Linked document detail */}
                {rec && (
                  <div className="px-4 py-2 bg-green-50 border-b text-xs text-green-800">
                    <span className="font-medium">CxC:</span> {rec.customerName} ·
                    Saldo: <strong>{USD(rec.balance)}</strong> ·
                    Cuenta: <strong>{rec.account_code}</strong>
                  </div>
                )}
                {pay && !rec && (
                  <div className="px-4 py-2 bg-blue-50 border-b text-xs text-blue-800">
                    <span className="font-medium">CxP:</span> {pay.supplierName} ·
                    Saldo: <strong>{USD(pay.balance)}</strong>
                  </div>
                )}

                {/* Tax lines */}
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b text-gray-400">
                      <th className="px-4 py-2 text-left font-medium">Tipo</th>
                      <th className="px-4 py-2 text-left font-medium">Cód. SRI</th>
                      <th className="px-4 py-2 text-right font-medium">Base</th>
                      <th className="px-4 py-2 text-right font-medium">%</th>
                      <th className="px-4 py-2 text-right font-medium">Retenido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lines.map((l, j) => (
                      <tr key={j}>
                        <td className="px-4 py-2 text-gray-700">{taxLabel(l.taxCode)}</td>
                        <td className="px-4 py-2 text-gray-600 font-mono">{l.retentionCode}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{USD(l.baseAmount)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{l.percentage}%</td>
                        <td className="px-4 py-2 text-right font-semibold text-green-700 tabular-nums">
                          {USD(l.retainedAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-gray-50">
                      <td colSpan={4} className="px-4 py-2 text-right text-xs text-gray-500 font-medium">
                        Total retenido
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-green-700 tabular-nums">
                        {USD(total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Journal preview for received retentions */}
                {direction === "received" && rec && (
                  <div className="px-4 py-3 bg-gray-50 border-t">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Asiento a registrar:</p>
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-gray-100">
                        {lines.filter((l) => l.taxCode === "1").length > 0 && (
                          <tr>
                            <td className="py-1 text-gray-700 font-medium">DR  Ret. IR por recuperar (1130201)</td>
                            <td className="py-1 text-right tabular-nums text-gray-800">
                              {USD(n2(lines.filter(l=>l.taxCode==="1").reduce((s,l)=>s+n2(l.retainedAmount),0)))}
                            </td>
                          </tr>
                        )}
                        {lines.filter((l) => l.taxCode === "2").length > 0 && (
                          <tr>
                            <td className="py-1 text-gray-700 font-medium">DR  Ret. IVA por recuperar (1130202)</td>
                            <td className="py-1 text-right tabular-nums text-gray-800">
                              {USD(n2(lines.filter(l=>l.taxCode==="2").reduce((s,l)=>s+n2(l.retainedAmount),0)))}
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td className="py-1 text-gray-700 font-medium">
                            CR  {rec.account_name} ({rec.account_code})
                          </td>
                          <td className="py-1 text-right tabular-nums text-gray-800">
                            {USD(total)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
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

          {/* Error / Success */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
          )}
          {saved && (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="font-semibold text-green-700">
                {direction === "received"
                  ? "Retención registrada — asiento contable y CxC actualizados"
                  : "Retención guardada exitosamente"}
              </p>
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
                className="px-5 py-2 text-sm font-semibold bg-[#0A3558] text-white rounded-lg hover:bg-[#0d4a75] disabled:opacity-40"
              >
                {saving
                  ? "Guardando…"
                  : direction === "received"
                  ? "💾 Registrar cobro por retención"
                  : "💾 Guardar retención"}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
