// ============================================================================
// Accounts Receivable + Accounts Payable Aging (CFO Dashboard)
// src/pages/AccountsReceivableAgingPage.tsx
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

import type { Receivable } from "@/types/Receivable";
import type { Payable } from "@/types/Payable";

import { fetchReceivables } from "@/services/receivablesService";
import { fetchPayables } from "@/services/payablesService";

import { buildARAging } from "@/utils/arAging";

// ============================================================================
// TYPES + HELPERS
// ============================================================================

type AgingRow = {
  current: number;
  "1-30": number;
  "31-60": number;
  "61-90": number;
  "90+": number;
  total: number;
};

function getDaysPastDue(dueDate?: string) {
  if (!dueDate) return 0;
  const today = new Date();
  const due = new Date(dueDate);
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function getAgingBucket(days: number): keyof AgingRow {
  if (days <= 0) return "current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AccountsReceivableAgingPage() {
  const { selectedEntity } = useSelectedEntity();
  const entityId = selectedEntity?.id ?? null;

  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  // ==========================================================================
  // LOAD DATA
  // ==========================================================================

  useEffect(() => {
    if (!entityId) return;

    setLoading(true);

    Promise.all([
      fetchReceivables(entityId),
      fetchPayables(entityId),
    ])
      .then(([rec, pay]) => {
        setReceivables(rec);
        setPayables(pay);
      })
      .finally(() => setLoading(false));
  }, [entityId]);

  // ==========================================================================
  // AR AGING
  // ==========================================================================

  const agingRows = useMemo(() => {
    return buildARAging(receivables);
  }, [receivables]);

  const invoicesByCustomer = useMemo(() => {
    const map: Record<string, Receivable[]> = {};

    for (const r of receivables) {
      const customer = r.customerName || r.customerRUC || "Cliente";

      if (!map[customer]) map[customer] = [];
      map[customer].push(r);
    }

    return map;
  }, [receivables]);

  // ==========================================================================
  // AP AGING (USE MEMO INSTEAD OF STATE 🚀)
  // ==========================================================================

  const apAging = useMemo(() => {
    const result: Record<string, AgingRow> = {};

    for (const p of payables) {
      const supplier =
        p.supplierName || p.supplierRUC || "Sin proveedor";

      if (!result[supplier]) {
        result[supplier] = {
          current: 0,
          "1-30": 0,
          "31-60": 0,
          "61-90": 0,
          "90+": 0,
          total: 0,
        };
      }

      if (p.installmentSchedule?.length) {
        for (const inst of p.installmentSchedule) {
          if (inst.balance <= 0) continue;

          const days = getDaysPastDue(inst.dueDate);
          const bucket = getAgingBucket(days);

          result[supplier][bucket] += inst.balance;
          result[supplier].total += inst.balance;
        }
      } else {
        const amount = p.balance ?? 0;
        if (amount <= 0) continue;

        const days = getDaysPastDue(p.dueDate);
        const bucket = getAgingBucket(days);

        result[supplier][bucket] += amount;
        result[supplier].total += amount;
      }
    }

    return result;
  }, [payables]);

  // ==========================================================================
  // SORT AP (IMPORTANT UX)
  // ==========================================================================

  const sortedAp = useMemo(() => {
    return Object.entries(apAging).sort((a, b) => b[1].total - a[1].total);
  }, [apAging]);

  // ==========================================================================
  // TOTALS (CFO VIEW)
  // ==========================================================================

  const totalAR = useMemo(
    () => agingRows.reduce((s, r) => s + r.total, 0),
    [agingRows]
  );

  const totalAP = useMemo(
    () => Object.values(apAging).reduce((s, v) => s + v.total, 0),
    [apAging]
  );

  const net = totalAR - totalAP;

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const today = new Date();

  const daysOld = (date?: string) => {
    if (!date) return 0;
    const diff = today.getTime() - new Date(date).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // ==========================================================================
  // GUARDS
  // ==========================================================================

  if (!entityId) {
    return (
      <div className="p-6 text-gray-500">
        Selecciona una empresa.
      </div>
    );
  }

  if (loading) {
    return <p className="p-6">Cargando aging report…</p>;
  }

  // ==========================================================================
  // UI
  // ==========================================================================

  return (
    <div className="p-6">

      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          Aging Dashboard
        </h1>
        <p className="text-sm text-gray-500">
          Cuentas por cobrar y pagar
        </p>
      </div>

      {/* NET POSITION */}
      <div className="mb-6 p-4 bg-white rounded-xl shadow flex gap-10">
        <div>
          <div className="text-sm text-gray-500">Clientes deben</div>
          <div className="text-lg font-bold">{formatMoney(totalAR)}</div>
        </div>

        <div>
          <div className="text-sm text-gray-500">Debes a proveedores</div>
          <div className="text-lg font-bold">{formatMoney(totalAP)}</div>
        </div>

        <div>
          <div className="text-sm text-gray-500">Posición neta</div>
          <div className={`text-lg font-bold ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatMoney(net)}
          </div>
        </div>
      </div>

      {/* ===================== AR TABLE ===================== */}
      <h2 className="text-lg font-semibold mb-2">
        Accounts Receivable Aging
      </h2>

      <div className="bg-white rounded shadow overflow-x-auto mb-10">
        <table className="w-full text-sm">
          <tbody>
            {agingRows.map((row) => (
              <React.Fragment key={row.customerName}>
                <tr
                  className="border-t cursor-pointer hover:bg-gray-50"
                  onClick={() =>
                    setExpandedCustomer(
                      expandedCustomer === row.customerName
                        ? null
                        : row.customerName
                    )
                  }
                >
                  <td className="p-3 font-medium">
                    {expandedCustomer === row.customerName ? "▼ " : "▶ "}
                    {row.customerName}
                  </td>

                  <td className="p-3 text-right">{formatMoney(row.total)}</td>
                </tr>

                {expandedCustomer === row.customerName && (
                  <tr>
                    <td colSpan={2} className="bg-gray-50">
                      {(invoicesByCustomer[row.customerName] || []).map((inv) => (
                        <div key={inv.id} className="flex justify-between px-6 py-2 border-t text-xs">
                          <span>{inv.invoiceNumber}</span>
                          <span>{formatMoney(Number(inv.balance || 0))}</span>
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===================== AP TABLE ===================== */}
      <h2 className="text-lg font-semibold mb-2">
        Accounts Payable Aging
      </h2>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <tbody>
            {sortedAp.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No hay cuentas por pagar
                </td>
              </tr>
            )}

            {sortedAp.map(([supplier, data]) => (
              <tr key={supplier} className="border-t hover:bg-gray-50">
                <td className="p-3">{supplier}</td>
                <td className="p-3 text-right">{formatMoney(data.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}