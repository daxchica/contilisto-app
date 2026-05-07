// ============================================================================
// Accounts Payable Aging
// src/pages/payables/AccountsPayableAging.tsx
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

import type { Payable } from "@/types/Payable";
import { fetchPayables } from "@/services/payablesService";
import { buildAPAging, type APAgingRow } from "@/utils/apAging";

// ============================================================================
// HELPERS
// ============================================================================

function formatMoney(n: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function getDaysPastDue(dateStr?: string) {
  if (!dateStr) return 0;
  const today = new Date();
  const due = new Date(dateStr);
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

const BUCKETS: { label: string; key: keyof APAgingRow; color: string; headerColor: string }[] = [
  { label: "0 – 30 días",   key: "current", color: "text-green-700",  headerColor: "text-green-700" },
  { label: "31 – 60 días",  key: "d30",     color: "text-yellow-600", headerColor: "text-yellow-600" },
  { label: "61 – 90 días",  key: "d60",     color: "text-orange-600", headerColor: "text-orange-600" },
  { label: "91 – 120 días", key: "d90",     color: "text-red-600",    headerColor: "text-red-600" },
  { label: "Más de 120",    key: "d120",    color: "text-red-700",    headerColor: "text-red-700" },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function AccountsPayableAging() {
  const { selectedEntity } = useSelectedEntity();
  const entityId = selectedEntity?.id ?? null;

  const [payables, setPayables] = useState<Payable[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    fetchPayables(entityId)
      .then((data) => setPayables(data))
      .finally(() => setLoading(false));
  }, [entityId]);

  // --------------------------------------------------------------------------
  // AGING ROWS
  // --------------------------------------------------------------------------

  const agingRows = useMemo(() => buildAPAging(payables), [payables]);

  const invoicesBySupplier = useMemo(() => {
    const map: Record<string, Payable[]> = {};
    for (const p of payables) {
      if (!p.balance || p.balance <= 0 || p.status === "paid") continue;
      const supplier = p.supplierName || p.supplierRUC || "Proveedor";
      if (!map[supplier]) map[supplier] = [];
      map[supplier].push(p);
    }
    return map;
  }, [payables]);

  // --------------------------------------------------------------------------
  // TOTALS
  // --------------------------------------------------------------------------

  const totals = useMemo(() => {
    const t: APAgingRow = {
      supplierName: "Total",
      current: 0, d30: 0, d60: 0, d90: 0, d120: 0, total: 0,
    };
    for (const row of agingRows) {
      t.current += row.current;
      t.d30     += row.d30;
      t.d60     += row.d60;
      t.d90     += row.d90;
      t.d120    += row.d120;
      t.total   += row.total;
    }
    return t;
  }, [agingRows]);

  // --------------------------------------------------------------------------
  // GUARDS
  // --------------------------------------------------------------------------

  if (!entityId) {
    return <div className="p-6 text-gray-500">Selecciona una empresa.</div>;
  }

  if (loading) {
    return <p className="p-6 text-blue-600 animate-pulse">Cargando aging CxP…</p>;
  }

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-red-700">📊 Aging Cuentas por Pagar</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {selectedEntity?.name} — antigüedad de saldos pendientes por proveedor
        </p>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {BUCKETS.map(({ label, key, color }) => {
          const val = totals[key] as number;
          return (
            <div key={key} className={`rounded-xl border px-4 py-3 bg-white ${color}`}>
              <p className="text-xs font-medium text-gray-500">{label}</p>
              <p className={`text-lg font-bold mt-0.5 ${color}`}>{formatMoney(val)}</p>
            </div>
          );
        })}
      </div>

      {/* TOTAL OUTSTANDING */}
      <div className="bg-red-700 text-white rounded-xl px-5 py-4 flex items-center justify-between">
        <span className="font-semibold">Total pendiente de pago</span>
        <span className="text-2xl font-bold">{formatMoney(totals.total)}</span>
      </div>

      {/* DETAIL TABLE */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3 text-left font-semibold text-gray-700">Proveedor</th>
              {BUCKETS.map(({ label, key, headerColor }, i) => (
                <th
                  key={key}
                  className={`p-3 text-right font-semibold ${headerColor} ${
                    i === 0 ? "hidden sm:table-cell" :
                    i <= 2  ? "hidden md:table-cell" :
                              "hidden lg:table-cell"
                  }`}
                >
                  {label}
                </th>
              ))}
              <th className="p-3 text-right font-semibold text-gray-800">Total</th>
            </tr>
          </thead>

          <tbody>
            {agingRows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-400">
                  No hay cuentas por pagar pendientes
                </td>
              </tr>
            )}

            {agingRows.map((row) => {
              const isOpen = expandedSupplier === row.supplierName;
              const invoices = invoicesBySupplier[row.supplierName] || [];

              return (
                <React.Fragment key={row.supplierName}>
                  <tr
                    className="border-t cursor-pointer hover:bg-gray-50 transition"
                    onClick={() => setExpandedSupplier(isOpen ? null : row.supplierName)}
                  >
                    <td className="p-3 font-medium">
                      <span className="mr-1 text-gray-400 text-xs">{isOpen ? "▼" : "▶"}</span>
                      {row.supplierName}
                    </td>
                    {BUCKETS.map(({ key, color }, i) => (
                      <td
                        key={key}
                        className={`p-3 text-right ${color} ${
                          i === 0 ? "hidden sm:table-cell" :
                          i <= 2  ? "hidden md:table-cell" :
                                    "hidden lg:table-cell"
                        }`}
                      >
                        {(row[key] as number) > 0 ? formatMoney(row[key] as number) : "—"}
                      </td>
                    ))}
                    <td className="p-3 text-right font-bold text-gray-800">
                      {formatMoney(row.total)}
                    </td>
                  </tr>

                  {/* Expanded invoice detail */}
                  {isOpen && (
                    <tr>
                      <td colSpan={7} className="bg-gray-50 border-t">
                        {invoices.length === 0 ? (
                          <p className="px-8 py-3 text-sm text-gray-400">Sin facturas</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-400">
                                <th className="px-8 py-1 text-left">Factura</th>
                                <th className="px-4 py-1 text-left hidden sm:table-cell">Fecha emisión</th>
                                <th className="px-4 py-1 text-right hidden md:table-cell">Días transcurridos</th>
                                <th className="px-4 py-1 text-right">Saldo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {invoices.map((inv) => {
                                const refDate = inv.dueDate || inv.issueDate;
                                const days = getDaysPastDue(refDate);
                                return (
                                  <tr key={inv.id} className="border-t border-gray-100">
                                    <td className="px-8 py-1.5 font-medium">{inv.invoiceNumber}</td>
                                    <td className="px-4 py-1.5 text-gray-500 hidden sm:table-cell">
                                      {inv.issueDate}
                                    </td>
                                    <td className="px-4 py-1.5 text-right hidden md:table-cell">
                                      {days > 30
                                        ? <span className="text-red-600 font-medium">{days}d</span>
                                        : <span className="text-green-600">{days}d</span>
                                      }
                                    </td>
                                    <td className="px-4 py-1.5 text-right font-semibold">
                                      {formatMoney(Number(inv.balance || 0))}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>

          {/* TOTALS FOOTER */}
          {agingRows.length > 0 && (
            <tfoot className="bg-gray-100 border-t-2">
              <tr className="font-semibold">
                <td className="p-3">Total</td>
                {BUCKETS.map(({ key, color }, i) => (
                  <td
                    key={key}
                    className={`p-3 text-right ${color} ${
                      i === 0 ? "hidden sm:table-cell" :
                      i <= 2  ? "hidden md:table-cell" :
                                "hidden lg:table-cell"
                    }`}
                  >
                    {(totals[key] as number) > 0 ? formatMoney(totals[key] as number) : "—"}
                  </td>
                ))}
                <td className="p-3 text-right text-red-700">
                  {formatMoney(totals.total)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

    </div>
  );
}
