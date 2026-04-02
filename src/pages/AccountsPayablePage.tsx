// ============================================================================
// src/pages/AccountsPayablePage.tsx
// CONTILISTO — Accounts Payable Page (REBUILT)
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

import { fetchPayables } from "@/services/payablesService";
import { rebuildPayablesFromJournal } from "@/services/rebuildPayablesFromJournal";
import { fetchBankAccountsFromCOA } from "@/services/coaService";

import RegisterPayablePaymentModal from "@/components/modals/RegisterPayablePaymentModal";
import EditPayableTermsModal from "@/components/payables/EditPayableTermsModal";
import PayableInstallmentsTable from "@/components/payables/PayableInstallmentsTable";

import type { Payable } from "@/types/Payable";
import type { BankAccount } from "@/types/bankTypes";

import { resolvePayableDueDate } from "@/utils/payable";
import { resolveSupplierName, resolveSupplierRUC } from "@/utils/supplier";

// ============================================================================
// COMPONENT
// ============================================================================

export default function AccountsPayablePage() {
  const { user } = useAuth();
  const { selectedEntity } = useSelectedEntity();

  const entityId = selectedEntity?.id ?? "";
  const userIdSafe = user?.uid ?? "";

  const [payables, setPayables] = useState<Payable[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const [editingPayable, setEditingPayable] = useState<Payable | null>(null);
  const [payingPayable, setPayingPayable] = useState<Payable | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ============================================================================
  // LOAD BANK ACCOUNTS
  // ============================================================================

  useEffect(() => {
    if (!entityId) return;

    const load = async () => {
      try {
        setAccountsLoading(true);

        const accounts = await fetchBankAccountsFromCOA(entityId);

        const mapped: BankAccount[] = accounts.map((a) => ({
          id: a.code,
          entityId,
          name: a.name,
          code: a.code,
          account_code: a.code,
        }));

        setBankAccounts(mapped);
      } catch (err) {
        console.error("Error loading bank accounts", err);
        setBankAccounts([]);
      } finally {
        setAccountsLoading(false);
      }
    };

    load();
  }, [entityId]);

  // ============================================================================
  // LOAD PAYABLES
  // ============================================================================

  const reload = useCallback(async () => {
    if (!entityId) {
      setPayables([]);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchPayables(entityId);
      setPayables(data);
    } catch (err) {
      console.error("Error loading payables", err);
      setPayables([]);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ============================================================================
  // DERIVED
  // ============================================================================

  const visiblePayables = useMemo(() => {
    return payables
      .filter((p) => p.status !== "paid")
      .sort((a, b) =>
        (a.dueDate ?? "").localeCompare(b.dueDate ?? "")
      );
  }, [payables]);

  const totalPending = useMemo(() => {
    return visiblePayables
      .reduce((sum, p) => sum + Number(p.balance || 0), 0)
      .toFixed(2);
  }, [visiblePayables]);

  // ============================================================================
  // GUARDS
  // ============================================================================

  if (!entityId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Cuentas por Pagar</h1>
        <p className="text-sm text-gray-600 mt-1">
          Selecciona una empresa.
        </p>
      </div>
    );
  }

  if (loading || accountsLoading) {
    return <p className="p-6">Cargando cuentas por pagar…</p>;
  }

  // ============================================================================
  // UI
  // ============================================================================

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Cuentas por Pagar</h1>
        <p className="text-sm text-gray-600">
          Facturas pendientes de pago
        </p>
      </div>

      {/* ACTIONS */}
      <div className="mb-4">
        <button
          onClick={async () => {
            await rebuildPayablesFromJournal(entityId);
            reload();
          }}
          className="bg-blue-600 text-white px-3 py-2 rounded"
        >
          🔄 Rebuild AP
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-500">Total pendiente</p>
          <p className="text-xl font-bold text-red-600">
            ${totalPending}
          </p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-500">Facturas</p>
          <p className="text-xl font-bold">
            {visiblePayables.length}
          </p>
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
                    <div className="font-medium">
                      {resolveSupplierName(p)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {resolveSupplierRUC(p)}
                    </div>
                  </td>

                  <td className="p-2">{p.invoiceNumber}</td>
                  <td className="p-2">{p.issueDate}</td>

                  <td className="p-2 text-right font-medium">
                    ${Number(p.balance || 0).toFixed(2)}
                  </td>

                  <td className="p-2">
                    {resolvePayableDueDate(p) ?? "—"}
                  </td>

                  <td className="p-2">
                    {p.status === "partial" ? (
                      <span className="text-yellow-600 text-xs">Parcial</span>
                    ) : (
                      <span className="text-red-600 text-xs">Pendiente</span>
                    )}
                  </td>

                  <td className="p-2 space-x-2">
                    <button
                      className="text-blue-600 text-xs"
                      onClick={() => setPayingPayable(p)}
                    >
                      Pagar
                    </button>

                    <button
                      className="text-blue-600 text-xs"
                      onClick={() => setEditingPayable(p)}
                    >
                      Editar
                    </button>

                    <button
                      className="text-blue-600 text-xs"
                      onClick={() =>
                        setExpandedId(expandedId === p.id ? null : p.id ?? null)
                      }
                    >
                      Cuotas
                    </button>
                  </td>
                </tr>

                {expandedId === p.id && (
                  <tr>
                    <td colSpan={7}>
                      <PayableInstallmentsTable
                        schedule={p.installmentSchedule ?? []}
                      />
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

      {payingPayable && (
        <RegisterPayablePaymentModal
          key={payingPayable.id} // 🔥 FORCE REMOUNT
          isOpen={!!payingPayable}
          entityId={entityId}
          userIdSafe={userIdSafe}
          payable={payingPayable}
          bankAccounts={bankAccounts}
          onClose={() => setPayingPayable(null)}
          onSaved={reload}
        />
      )}

      {editingPayable && (
        <EditPayableTermsModal
          isOpen={true}
          entityId={entityId}
          payable={editingPayable}
          onClose={() => setEditingPayable(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}