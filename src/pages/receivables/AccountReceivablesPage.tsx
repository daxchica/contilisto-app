// ============================================================================
// src/pages/AccountsReceivablePage.tsx
// CONTILISTO — Accounts Receivable Page (matched to AP UI)
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { Account } from "@/types/AccountTypes";
import type { Receivable } from "@/types/Receivable";

import { fetchAccounts } from "@/services/accountService";
import { fetchReceivables } from "@/services/receivablesService";

import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { useAuth } from "@/context/AuthContext";

import PayableInstallmentsTable from "@/components/payables/PayableInstallmentsTable";
import ARPaymentModal from "@/components/modals/ARPaymentModal";

import { resolveReceivableDueDate } from "@/utils/payable";

// ============================================================================
// COMPONENT
// ============================================================================

export default function AccountsReceivablePage() {
  const { selectedEntity } = useSelectedEntity();
  const { user } = useAuth();
  const navigate = useNavigate();

  const entityId = selectedEntity?.id ?? "";
  const userIdSafe = user?.uid ?? "";

  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const [expandedReceivableId, setExpandedReceivableId] = useState<string | null>(null);
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);

  // ============================================================================
  // LOAD ACCOUNTS
  // ============================================================================

  useEffect(() => {
    if (!entityId) return;

    const loadAccounts = async () => {
      try {
        setAccountsLoading(true);
        const data = await fetchAccounts(entityId);
        setAccounts(data);
      } catch (err) {
        console.error("Error loading accounts", err);
        setAccounts([]);
      } finally {
        setAccountsLoading(false);
      }
    };

    loadAccounts();
  }, [entityId]);

  // ============================================================================
  // LOAD RECEIVABLES
  // ============================================================================

  const reload = useCallback(async () => {
    if (!entityId) {
      setReceivables([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchReceivables(entityId);
      setReceivables(data);
    } catch (err) {
      console.error("Error loading receivables", err);
      setReceivables([]);
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

  const visibleReceivables = useMemo(() => {
    return receivables
      .filter((r) => r.status !== "paid")
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  }, [receivables]);

  const totalPending = useMemo(() => {
    return visibleReceivables
      .reduce((sum, r) => sum + Number(r.balance || 0), 0)
      .toFixed(2);
  }, [visibleReceivables]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const renderStatus = (status?: string) => {
    if (status === "partial") {
      return <span className="text-yellow-600 text-xs">Parcial</span>;
    }

    if (status === "paid") {
      return <span className="text-green-600 text-xs">Cobrado</span>;
    }

    return <span className="text-red-600 text-xs">Pendiente</span>;
  };

  // ============================================================================
  // GUARDS
  // ============================================================================

  if (!entityId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Cuentas por Cobrar</h1>
        <p className="text-sm text-gray-600 mt-1">
          Selecciona una empresa.
        </p>
      </div>
    );
  }

  if (loading || accountsLoading) {
    return <p className="p-6">Cargando cuentas por cobrar…</p>;
  }

  // ============================================================================
  // UI
  // ============================================================================

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cuentas por Cobrar</h1>
          <p className="text-sm text-gray-600">
            Facturas pendientes de cobro
          </p>
        </div>

        <button
          onClick={() => navigate("/cartera/historial?type=ar")}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          📜 Ver historial completo
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-500">Total por cobrar</p>
          <p className="text-xl font-bold text-green-700">${totalPending}</p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-500">Facturas</p>
          <p className="text-xl font-bold">{visibleReceivables.length}</p>
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
                    <div className="font-medium">
                      {r.customerName || "Cliente"}
                    </div>
                    <div className="text-xs text-gray-400">
                      {r.customerRUC || "—"}
                    </div>
                  </td>

                  <td className="p-2">{r.invoiceNumber}</td>
                  <td className="p-2">{r.issueDate}</td>

                  <td className="p-2 text-right font-medium">
                    ${Number(r.balance || 0).toFixed(2)}
                  </td>

                  <td className="p-2">
                    {resolveReceivableDueDate(r) ?? "—"}
                  </td>

                  <td className="p-2">{renderStatus(r.status)}</td>

                  <td className="p-2 space-x-2">
                    <button
                      className="text-blue-600 text-xs"
                      onClick={() => setSelectedReceivable(r)}
                    >
                      Cobrar
                    </button>

                    <button
                      className="text-blue-600 text-xs"
                      onClick={() =>
                        setExpandedReceivableId(
                          expandedReceivableId === r.id ? null : r.id ?? null
                        )
                      }
                    >
                      Cuotas
                    </button>
                  </td>
                </tr>

                {expandedReceivableId === r.id && (
                  <tr>
                    <td colSpan={7}>
                      <PayableInstallmentsTable
                        schedule={r.installmentSchedule ?? []}
                      />
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

      {/* MODAL */}
      {selectedReceivable && entityId && userIdSafe && (
        <ARPaymentModal
          entityId={entityId}
          userId={userIdSafe}
          receivable={selectedReceivable}
          accounts={accounts}
          onClose={() => setSelectedReceivable(null)}
          onSuccess={reload}
        />
      )}
    </div>
  );
}