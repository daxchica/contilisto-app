// src/pages/payables/AccountsPayableAging.tsx

import React, { useEffect, useState, useMemo } from "react";
import { fetchPayables } from "@/services/payablesService";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import type { Payable } from "@/types/Payable";

type AgingRow = {
  current: number;
  "1-30": number;
  "31-60": number;
  "61-90": number;
  "90+": number;
  total: number;
};

function getDaysPastDue(dueDate?: string): number {
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

function createEmptyRow(): AgingRow {
  return {
    current: 0,
    "1-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
    total: 0,
  };
}

export default function AccountsPayableAging() {
  const { selectedEntity } = useSelectedEntity();

  const [payables, setPayables] = useState<Payable[]>([]);
  const [aging, setAging] = useState<Record<string, AgingRow>>({});
  const [loading, setLoading] = useState(true);

  // ==========================================================================
  // LOAD DATA
  // ==========================================================================

  useEffect(() => {
    if (!selectedEntity?.id) return;

    setLoading(true);

    fetchPayables(selectedEntity.id)
      .then(setPayables)
      .finally(() => setLoading(false));
  }, [selectedEntity?.id]);

  // ==========================================================================
  // BUILD AGING
  // ==========================================================================

  useEffect(() => {
    const result: Record<string, AgingRow> = {};

    for (const p of payables) {
      const supplier =
        p.supplierName || p.supplierRUC || "Sin proveedor";

      if (!result[supplier]) {
        result[supplier] = createEmptyRow();
      }

      // 🔹 WITH INSTALLMENTS
      if (p.installmentSchedule?.length) {
        for (const inst of p.installmentSchedule) {
          if (inst.balance <= 0) continue;

          const days = getDaysPastDue(inst.dueDate);
          const bucket = getAgingBucket(days);

          result[supplier][bucket] += inst.balance;
          result[supplier].total += inst.balance;
        }
      }

      // 🔹 WITHOUT INSTALLMENTS
      else {
        const amount = p.balance ?? 0;
        if (amount <= 0) continue;

        const days = getDaysPastDue(p.dueDate);
        const bucket = getAgingBucket(days);

        result[supplier][bucket] += amount;
        result[supplier].total += amount;
      }
    }

    setAging(result);
  }, [payables]);

  // ==========================================================================
  // SORT (CFO VIEW)
  // ==========================================================================

  const sortedEntries = useMemo(() => {
    return Object.entries(aging).sort((a, b) => b[1].total - a[1].total);
  }, [aging]);

  // ==========================================================================
  // FORMAT
  // ==========================================================================

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);

  // ==========================================================================
  // UI STATES
  // ==========================================================================

  if (!selectedEntity?.id) {
    return (
      <div className="p-6 text-gray-500">
        Selecciona una empresa para continuar
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-gray-500">
        Cargando cuentas por pagar...
      </div>
    );
  }

  // ==========================================================================
  // UI
  // ==========================================================================

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-2">
        Accounts Payable Aging
      </h1>

      <p className="text-sm text-gray-500 mb-4">
        Antigüedad de cuentas por pagar
      </p>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Proveedor</th>
              <th className="p-3">Current</th>
              <th className="p-3">1-30</th>
              <th className="p-3">31-60</th>
              <th className="p-3">61-90</th>
              <th className="p-3">90+</th>
              <th className="p-3 font-semibold">Total</th>
            </tr>
          </thead>

          <tbody>
            {sortedEntries.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-gray-500"
                >
                  No hay cuentas por pagar registradas
                </td>
              </tr>
            )}

            {sortedEntries.map(([supplier, data]) => (
              <tr
                key={supplier}
                className="border-t hover:bg-gray-50 transition"
              >
                <td className="p-3 font-medium">{supplier}</td>

                <td className="p-3">
                  {formatMoney(data.current)}
                </td>

                <td className="p-3">
                  {formatMoney(data["1-30"])}
                </td>

                <td className="p-3">
                  {formatMoney(data["31-60"])}
                </td>

                <td className="p-3">
                  {formatMoney(data["61-90"])}
                </td>

                <td className="p-3 text-red-600 font-semibold">
                  {formatMoney(data["90+"])}
                </td>

                <td className="p-3 font-bold">
                  {formatMoney(data.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}