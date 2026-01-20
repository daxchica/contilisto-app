// src/pages/AccountsPayablePage.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { fetchPayables } from "@/services/payablesService";
import type { Payable } from "@/types/Payable";

import { useBankAccounts } from "@/hooks/useBankAccounts";

import EditPayableTermsModal from "@/components/payables/EditPayableTermsModal";
import RegisterPayablePaymentModal from "@/components/payables/RegisterPayablePaymentModal";
import PayableInstallmentsTable from "@/components/payables/PayableInstallmentsTable";

export default function AccountsPayablePage() {
  const { selectedEntity } = useSelectedEntity();

  const entityId = selectedEntity?.id ?? null;
  const userId = selectedEntity?.uid ?? null;

  const { 
    bankAccounts: rawBankAccounts, 
    loading: accountsLoading 
  } = useBankAccounts(entityId ?? "", userId ?? "");

  const [payables, setPayables] = useState<Payable[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingPayable, setEditingPayable] = useState<Payable | null>(null);
  const [payingPayable, setPayingPayable] = useState<Payable | null>(null);
  const [expandedPayableId, setExpandedPayableId] = useState<string | null>(null);

  // --------------------------------------------------
  // Reload payables
  // --------------------------------------------------
  const reload = useCallback(() => {
    if (!entityId) {
    setPayables([]);
    setLoading(false);
    return;
  }

  setLoading(true);
  fetchPayables(entityId)
    .then(setPayables)
    .finally(() => setLoading(false));
}, [entityId]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  // --------------------------------------------------
  // Derived data
  // --------------------------------------------------
  const visiblePayables = useMemo(
    () => payables.filter(p => p.status !== "paid"),
    [payables]
  );

  const totalPending = useMemo(
    () => 
      visiblePayables.reduce(
        (sum, p) => sum + Number(p.balance || 0), 0),
    [visiblePayables]
  );

  const pendingCount = visiblePayables.length;

  // --------------------------------------------------
  // Guards
  // --------------------------------------------------
  if (!entityId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Cuentas por Pagar</h1>
        <p className="text-sm text-gray-600 mt-1">
          Selecciona una empresa para ver las facturas pendientes.
        </p>
      </div>
    );
  }

  if (loading || accountsLoading) {
    return <p className="p-6">Cargando cuentas por pagar…</p>;
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Cuentas por Pagar</h1>
        <p className="text-sm text-gray-600 mt-1">
          Facturas pendientes de pago a proveedores
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-500">Total pendiente</p>
          <p className="text-xl font-bold text-red-600">
            ${totalPending.toFixed(2)}
          </p>
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
              <th className="p-2 text-left">Proveedor</th>
              <th className="p-2">Factura</th>
              <th className="p-2">Fecha</th>
              <th className="p-2 text-right">Saldo</th>
              <th className="p-2">Vence</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {visiblePayables.map((p) => (
              <React.Fragment key={p.id}>
                <tr className="border-t">
                  <td className="p-2">
                    {p.supplierName || "Proveedor"}
                    {p.supplierRUC && (
                      <div className="text-xs text-gray-400">{p.supplierRUC}</div>
                    )}
                  </td>

                  <td className="p-2">{p.invoiceNumber}</td>
                  <td className="p-2">{p.issueDate}</td>

                  <td className="p-2 text-right font-medium">
                    ${Number(p.balance || 0).toFixed(2)}
                  </td>

                  <td className="p-2">{p.dueDate || "—"}</td>

                  <td className="p-2">
                    {p.status === "paid" ? (
                      <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">
                        Pagado
                      </span>
                    ) : p.status === "partial" ? (
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
                    <button
                      className="text-blue-600 hover:underline text-xs"
                      onClick={() => setPayingPayable(p)}
                      disabled={p.status === "paid"}
                    >
                      Pagar
                    </button>

                    <button
                      className="text-blue-600 hover:underline text-xs"
                      onClick={() => setEditingPayable(p)}
                    >
                      Editar plazos
                    </button>

                    <button
                      className="text-blue-600 hover:underline text-xs"
                      onClick={() =>
                        setExpandedPayableId(
                          expandedPayableId === p.id ? null : (p.id ?? null))
                      }
                    >
                      {expandedPayableId === p.id ? "Ocultar cuotas" : "Ver cuotas"}
                    </button>
                  </td>
                </tr>

                {expandedPayableId === p.id && (
                  <tr className="border-b">
                    <td colSpan={7} className="p-0">
                      <PayableInstallmentsTable schedule={p.installmentSchedule ?? []} />
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}

              {visiblePayables.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-500">
                    No existen cuentas por pagar
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MODALS */}
        {editingPayable && (
          <EditPayableTermsModal
            isOpen={true}
            entityId={entityId}
            payable={editingPayable}
            onClose={() => setEditingPayable(null)}
            onSaved={() => {
              setEditingPayable(null);
              reload();
            }}
          />
        )}
      
        {payingPayable && (
          <RegisterPayablePaymentModal
            isOpen={true}
            entityId={entityId}
            userId={userId!}
            payable={payingPayable}
            bankAccounts={rawBankAccounts}
            onClose={() => setPayingPayable(null)}
            onSaved={reload}
            
          />
        )}
      </div>
    );
}