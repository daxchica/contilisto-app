// ============================================================================
// src/pages/payables/AccountsPayablePage.tsx
// CONTILISTO — Accounts Payable Page
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

import { fetchPayables } from "@/services/payablesService";
import { fetchBankAccountsFromCOA } from "@/services/coaService";

import RegisterPayablePaymentModal from "@/components/modals/RegisterPayablePaymentModal";
import EditPayableTermsModal from "@/components/payables/EditPayableTermsModal";
import PayableInstallmentsTable from "@/components/payables/PayableInstallmentsTable";

import type { Payable } from "@/types/Payable";
import type { BankAccount } from "@/types/bankTypes";

import { resolvePayableDueDate } from "@/utils/payable";
import { resolveSupplierName, resolveSupplierRUC } from "@/utils/supplier";

// ── Sort helpers ──────────────────────────────────────────────────────────────
type SortKey = "invoiceNumber" | "issueDate" | "balance" | "dueDate";
type SortDir = "asc" | "desc";

function norm(s: string) {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AccountsPayablePage() {
  const { user } = useAuth();
  const { selectedEntity } = useSelectedEntity();

  const entityId   = selectedEntity?.id  ?? "";
  const userIdSafe = user?.uid           ?? "";
  const navigate   = useNavigate();

  const [payables,      setPayables]      = useState<Payable[]>([]);
  const [bankAccounts,  setBankAccounts]  = useState<BankAccount[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const [editingPayable, setEditingPayable] = useState<Payable | null>(null);
  const [payingPayable,  setPayingPayable]  = useState<Payable | null>(null);
  const [expandedId,     setExpandedId]     = useState<string | null>(null);

  // Search + sort
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey,     setSortKey]     = useState<SortKey>("dueDate");
  const [sortDir,     setSortDir]     = useState<SortDir>("asc");

  // ── Load bank accounts ────────────────────────────────────────────────────
  useEffect(() => {
    if (!entityId) return;
    setAccountsLoading(true);
    fetchBankAccountsFromCOA(entityId)
      .then((accounts) =>
        setBankAccounts(
          accounts.map((a) => ({
            id: a.code, entityId, name: a.name, code: a.code, account_code: a.code,
          }))
        )
      )
      .catch(() => setBankAccounts([]))
      .finally(() => setAccountsLoading(false));
  }, [entityId]);

  // ── Load payables ─────────────────────────────────────────────────────────
  const reload = useCallback(async () => {
    if (!entityId) { setPayables([]); return; }
    setLoading(true);
    try {
      setPayables(await fetchPayables(entityId));
    } catch {
      setPayables([]);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => { reload(); }, [reload]);

  // ── Toggle sort ───────────────────────────────────────────────────────────
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? <span className="ml-1 text-blue-600">{sortDir === "asc" ? "▲" : "▼"}</span>
      : <span className="ml-1 text-gray-300">⇅</span>;

  // ── Derived: filter → sort ────────────────────────────────────────────────
  const visiblePayables = useMemo(() => {
    const q = norm(searchQuery);

    const filtered = payables
      .filter((p) => p.status !== "paid")
      .filter((p) => {
        if (!q) return true;
        return (
          norm(resolveSupplierName(p)).includes(q) ||
          norm(resolveSupplierRUC(p) ?? "").includes(q)  ||
          norm(p.invoiceNumber ?? "").includes(q)
        );
      });

    filtered.sort((a, b) => {
      let va = "", vb = "";
      if (sortKey === "invoiceNumber") { va = a.invoiceNumber ?? ""; vb = b.invoiceNumber ?? ""; }
      if (sortKey === "issueDate")     { va = a.issueDate     ?? ""; vb = b.issueDate     ?? ""; }
      if (sortKey === "balance") {
        const diff = Number(a.balance ?? 0) - Number(b.balance ?? 0);
        return sortDir === "asc" ? diff : -diff;
      }
      if (sortKey === "dueDate") {
        va = resolvePayableDueDate(a) || "";
        vb = resolvePayableDueDate(b) || "";
      }
      const cmp = va.localeCompare(vb);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [payables, searchQuery, sortKey, sortDir]);

  const totalPending = useMemo(
    () => visiblePayables.reduce((s, p) => s + Number(p.balance || 0), 0).toFixed(2),
    [visiblePayables]
  );

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!entityId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Cuentas por Pagar</h1>
        <p className="text-sm text-gray-600 mt-1">Selecciona una empresa.</p>
      </div>
    );
  }

  if (loading || accountsLoading) {
    return <p className="p-6">Cargando cuentas por pagar…</p>;
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">

      {/* HEADER */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cuentas por Pagar</h1>
          <p className="text-sm text-gray-600">Facturas pendientes de pago</p>
        </div>
        <button
          onClick={() => navigate("/cartera/historial?type=ap")}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
        >
          🗂️ Vista por grupos
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-500">Total pendiente</p>
          <p className="text-xl font-bold text-red-600">${totalPending}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-500">Facturas</p>
          <p className="text-xl font-bold">{visiblePayables.length}</p>
        </div>
      </div>

      {/* SEARCH */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar proveedor, RUC o factura…"
            className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white shadow rounded overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="p-3 text-left">Proveedor</th>
              <th
                className="p-3 text-left cursor-pointer hover:text-blue-600 select-none"
                onClick={() => toggleSort("invoiceNumber")}
              >
                Factura <SortIcon col="invoiceNumber" />
              </th>
              <th
                className="p-3 text-left hidden sm:table-cell cursor-pointer hover:text-blue-600 select-none"
                onClick={() => toggleSort("issueDate")}
              >
                Fecha <SortIcon col="issueDate" />
              </th>
              <th
                className="p-3 text-right cursor-pointer hover:text-blue-600 select-none"
                onClick={() => toggleSort("balance")}
              >
                Saldo <SortIcon col="balance" />
              </th>
              <th
                className="p-3 text-left hidden md:table-cell cursor-pointer hover:text-blue-600 select-none"
                onClick={() => toggleSort("dueDate")}
              >
                Vence <SortIcon col="dueDate" />
              </th>
              <th className="p-3 text-left">Estado</th>
              <th className="p-3 text-left">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {visiblePayables.map((p) => (
              <React.Fragment key={p.id}>
                <tr className="border-t hover:bg-gray-50 transition-colors">
                  <td className="p-3">
                    <div className="font-medium leading-tight">{resolveSupplierName(p)}</div>
                    <div className="text-xs text-gray-400">{resolveSupplierRUC(p)}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">{p.invoiceNumber}</td>
                  <td className="p-3 hidden sm:table-cell text-gray-600">{p.issueDate}</td>
                  <td className="p-3 text-right font-semibold">
                    ${Number(p.balance || 0).toFixed(2)}
                  </td>
                  <td className="p-3 hidden md:table-cell text-gray-600">
                    {resolvePayableDueDate(p) ?? "—"}
                  </td>
                  <td className="p-3">
                    {p.status === "partial"
                      ? <span className="text-yellow-600 text-xs font-medium">Parcial</span>
                      : <span className="text-red-600 text-xs font-medium">Pendiente</span>}
                  </td>
                  <td className="p-3 space-x-3 whitespace-nowrap">
                    <button className="text-blue-600 text-xs hover:underline" onClick={() => setPayingPayable(p)}>
                      Pagar
                    </button>
                    <button className="text-blue-600 text-xs hover:underline" onClick={() => setEditingPayable(p)}>
                      Editar
                    </button>
                    <button
                      className="text-blue-600 text-xs hover:underline"
                      onClick={() => setExpandedId(expandedId === p.id ? null : p.id ?? null)}
                    >
                      Cuotas
                    </button>
                  </td>
                </tr>

                {expandedId === p.id && (
                  <tr>
                    <td colSpan={7}>
                      <PayableInstallmentsTable schedule={p.installmentSchedule ?? []} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}

            {visiblePayables.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  {searchQuery
                    ? `Sin resultados para "${searchQuery}"`
                    : "No existen cuentas por pagar"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODALS */}
      {payingPayable && (
        <RegisterPayablePaymentModal
          key={payingPayable.id}
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
