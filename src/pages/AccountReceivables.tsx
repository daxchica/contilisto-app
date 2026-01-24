// src/pages/AccountsReceivablePage.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

import type { Receivable } from "@/types/Receivable";
import { fetchReceivables } from "@/services/receivablesService";

import PayableInstallmentsTable from "@/components/payables/PayableInstallmentsTable";

export default function AccountsReceivablePage() {
  const { selectedEntity } = useSelectedEntity();

  const entityId = selectedEntity?.id ?? null;

  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedReceivableId, setExpandedReceivableId] = useState<string | null>(null);

  // --------------------------------------------------
  // Reload receivables (safe against race conditions)
  // --------------------------------------------------
  const reload = useCallback(() => {
    if (!entityId) {
      setReceivables([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchReceivables(entityId)
      .then((data: Receivable[]) => {
        if (!cancelled) setReceivables(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entityId]);

  useEffect(() => {
    const cleanup = reload();
    return cleanup;
  }, [reload]);

  // --------------------------------------------------
  // Derived data
  // --------------------------------------------------
  const visibleReceivables = useMemo(
    () =>
      receivables
        .filter((r) => r.status !== "paid")
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")),
    [receivables]
  );

  const totalPending = useMemo(() => {
    const total = visibleReceivables.reduce((sum, r) => sum + Number(r.balance || 0), 0);
    return total.toFixed(2);
  }, [visibleReceivables]);

  const pendingCount = visibleReceivables.length;

  // --------------------------------------------------
  // Guards
  // --------------------------------------------------
  if (!entityId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Cuentas por Cobrar</h1>
        <p className="text-sm text-gray-600 mt-1">
          Selecciona una empresa para ver la cartera pendiente.
        </p>
      </div>
    );
  }

  if (loading) {
    return <p className="p-6">Cargando cuentas por cobrar…</p>;
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Cuentas por Cobrar</h1>
        <p className="text-sm text-gray-600 mt-1">
          Facturas pendientes de cobro a clientes
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-500">Total por cobrar</p>
          <p className="text-xl font-bold text-green-700">${totalPending}</p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-500">Facturas pendientes</p>
          <p className="text-xl font-bold">{pendingCount}</p>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white shadow rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Cliente</th>
              <th className="p-2">Factura</th>
              <th className="p-2">Fecha</th>
              <th className="p-2 text-right">Saldo</th>
              <th className="p-2">Vence</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {visibleReceivables.map((r) => (
              <React.Fragment key={r.id}>
                <tr className="border-t">
                  <td className="p-2">
                    {r.customerName || "Cliente"}
                    {r.customerRUC && (
                      <div className="text-xs text-gray-400">{r.customerRUC}</div>
                    )}
                  </td>

                  <td className="p-2">{r.invoiceNumber}</td>
                  <td className="p-2">{r.issueDate}</td>

                  <td className="p-2 text-right font-medium">
                    ${Number(r.balance || 0).toFixed(2)}
                  </td>

                  <td className="p-2">{r.dueDate || "—"}</td>

                  <td className="p-2">
                    {r.status === "paid" ? (
                      <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">
                        Cobrado
                      </span>
                    ) : r.status === "partial" ? (
                      <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700">
                        Parcial
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700">
                        Pendiente
                      </span>
                    )}
                  </td>

                  <td className="p-2 space-x-3">
                    {/* v1: only view schedule, mirror payables */}
                    <button
                      className="text-blue-600 hover:underline text-xs"
                      onClick={() =>
                        setExpandedReceivableId(
                          expandedReceivableId === r.id ? null : (r.id ?? null)
                        )
                      }
                    >
                      {expandedReceivableId === r.id ? "Ocultar cuotas" : "Ver cuotas"}
                    </button>

                    {/* v1 placeholder: collection modal will come next */}
                    <button
                      className="text-blue-600 hover:underline text-xs"
                      disabled
                      title="Se implementará en el siguiente paso"
                    >
                      Cobrar
                    </button>
                  </td>
                </tr>

                {expandedReceivableId === r.id && (
                  <tr className="border-b">
                    <td colSpan={7} className="p-0">
                      <PayableInstallmentsTable schedule={r.installmentSchedule ?? []} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}

            {visibleReceivables.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  No existen cuentas por cobrar
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}