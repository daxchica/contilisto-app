// src/components/modals/IgnoredInvoicesReportModal.tsx
import React, { useState } from "react";
import type { JournalEntry } from "@/types/JournalEntry";
import type { InvoicePreviewMetadata } from "@/types/InvoicePreviewMetadata";

interface IgnoredItem {
  entries: JournalEntry[];
  metadata: InvoicePreviewMetadata;
}

interface Props {
  invoices: IgnoredItem[];
  onClose: () => void;
  onSaveIgnored?: (item: IgnoredItem) => Promise<void>;
}

function fmt(n: number) {
  return n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function totalFromEntries(entries: JournalEntry[]): number {
  return entries.reduce((sum, e) => sum + Number(e.credit || 0), 0);
}

export default function IgnoredInvoicesReportModal({ invoices, onClose, onSaveIgnored }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());

  const toggle = (i: number) => setExpanded((prev) => (prev === i ? null : i));

  const handleSaveIgnored = async (item: IgnoredItem, i: number) => {
    if (!onSaveIgnored) return;
    setSavingIdx(i);
    try {
      await onSaveIgnored(item);
      setSavedSet((prev) => new Set([...prev, i]));
    } catch (err: any) {
      alert(err?.message || "Error al guardar el asiento.");
    } finally {
      setSavingIdx(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-amber-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h2 className="text-lg font-bold text-amber-800">
                Facturas Ignoradas
              </h2>
              <p className="text-xs text-amber-600">
                {invoices.length} {invoices.length === 1 ? "factura fue ignorada" : "facturas fueron ignoradas"} durante el procesamiento
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl font-bold leading-none"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {invoices.map((item, i) => {
            const m = item.metadata;
            const total = totalFromEntries(item.entries);
            const isOpen = expanded === i;
            const debitLines = item.entries.filter((e) => Number(e.debit) > 0);
            const creditLines = item.entries.filter((e) => Number(e.credit) > 0);

            return (
              <div key={i} className="border border-amber-200 rounded-xl overflow-hidden">
                {/* Row summary */}
                <button
                  onClick={() => toggle(i)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100 transition text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-amber-500 font-bold text-sm shrink-0">
                      #{i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {m.invoice_number ?? "Sin número"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {m.issuerName ?? m.issuerRUC ?? "Proveedor desconocido"}
                        {m.invoiceDate ? ` — ${m.invoiceDate}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-sm font-semibold text-gray-700">
                      ${fmt(total)}
                    </span>
                    <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                      {m.invoiceType === "expense" ? "Gasto" : "Venta"}
                    </span>
                    {savedSet.has(i) ? (
                      <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        ✔ Guardada
                      </span>
                    ) : onSaveIgnored && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSaveIgnored(item, i); }}
                        disabled={savingIdx === i}
                        className="text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-0.5 rounded-full transition disabled:opacity-50"
                      >
                        {savingIdx === i ? "Guardando…" : "💾 Guardar"}
                      </button>
                    )}
                    <span className="text-gray-400 text-xs">{isOpen ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-4 py-3 bg-white border-t border-amber-100 space-y-3 text-sm">

                    {/* Metadata grid */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600">
                      {m.invoice_number && (
                        <>
                          <span className="font-medium text-gray-700">Factura</span>
                          <span>{m.invoice_number}</span>
                        </>
                      )}
                      {m.invoiceDate && (
                        <>
                          <span className="font-medium text-gray-700">Fecha</span>
                          <span>{m.invoiceDate}</span>
                        </>
                      )}
                      {m.issuerRUC && (
                        <>
                          <span className="font-medium text-gray-700">RUC emisor</span>
                          <span>{m.issuerRUC}</span>
                        </>
                      )}
                      {m.issuerName && (
                        <>
                          <span className="font-medium text-gray-700">Razón social</span>
                          <span>{m.issuerName}</span>
                        </>
                      )}
                      <span className="font-medium text-gray-700">Total</span>
                      <span className="font-semibold text-gray-800">${fmt(total)}</span>
                    </div>

                    {/* Journal lines */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Líneas del asiento
                      </p>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 text-left">
                            <th className="px-2 py-1">Cuenta</th>
                            <th className="px-2 py-1 text-right">Débito</th>
                            <th className="px-2 py-1 text-right">Crédito</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.entries.map((e, j) => (
                            <tr key={j} className="border-t border-gray-100">
                              <td className="px-2 py-1 text-gray-700">
                                <span className="text-gray-400 mr-1">{e.account_code}</span>
                                {e.account_name}
                              </td>
                              <td className="px-2 py-1 text-right text-green-700">
                                {Number(e.debit) > 0 ? `$${fmt(Number(e.debit))}` : "—"}
                              </td>
                              <td className="px-2 py-1 text-right text-red-600">
                                {Number(e.credit) > 0 ? `$${fmt(Number(e.credit))}` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-500">
            Estas facturas no fueron registradas en el sistema.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
