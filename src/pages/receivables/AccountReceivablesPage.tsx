// ============================================================================
// src/pages/receivables/AccountReceivablesPage.tsx
// CONTILISTO — Accounts Receivable Page
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { Account } from "@/types/AccountTypes";
import type { Receivable } from "@/types/Receivable";
import type { BankAccount } from "@/types/bankTypes";

import { fetchAccounts } from "@/services/accountService";
import { fetchReceivables } from "@/services/receivablesService";
import { fetchBankAccountsFromCOA } from "@/services/coaService";

import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { useAuth } from "@/context/AuthContext";

import PayableInstallmentsTable from "@/components/payables/PayableInstallmentsTable";
import ARPaymentModal from "@/components/modals/ARPaymentModal";

import { resolveReceivableDueDate } from "@/utils/payable";

// ── Sort helpers ──────────────────────────────────────────────────────────────
type SortKey = "invoiceNumber" | "issueDate" | "balance" | "dueDate";
type SortDir = "asc" | "desc";

function norm(s: string) {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AccountsReceivablePage() {
  const { selectedEntity } = useSelectedEntity();
  const { user } = useAuth();
  const navigate = useNavigate();

  const entityId   = selectedEntity?.id ?? "";
  const userIdSafe = user?.uid          ?? "";

  const [receivables,   setReceivables]   = useState<Receivable[]>([]);
  const [accounts,      setAccounts]      = useState<Account[]>([]);
  const [bankAccounts,  setBankAccounts]  = useState<BankAccount[]>([]);

  const [loading,         setLoading]         = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const [expandedReceivableId, setExpandedReceivableId] = useState<string | null>(null);
  const [selectedReceivable,   setSelectedReceivable]   = useState<Receivable | null>(null);

  // Search + sort
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey,     setSortKey]     = useState<SortKey>("dueDate");
  const [sortDir,     setSortDir]     = useState<SortDir>("asc");

  // ── Load accounts + bank accounts ─────────────────────────────────────────
  useEffect(() => {
    if (!entityId) return;
    setAccountsLoading(true);

    Promise.all([
      fetchAccounts(entityId),
      fetchBankAccountsFromCOA(entityId),
    ])
      .then(([accs, banks]) => {
        setAccounts(accs);
        setBankAccounts(
          banks.map((b) => ({
            id: b.code, entityId, name: b.name, code: b.code, account_code: b.code,
          }))
        );
      })
      .catch(() => { setAccounts([]); setBankAccounts([]); })
      .finally(() => setAccountsLoading(false));
  }, [entityId]);

  // ── Load receivables ──────────────────────────────────────────────────────
  const reload = useCallback(async () => {
    if (!entityId) { setReceivables([]); setLoading(false); return; }
    setLoading(true);
    try {
      setReceivables(await fetchReceivables(entityId));
    } catch {
      setReceivables([]);
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
  const visibleReceivables = useMemo(() => {
    const q = norm(searchQuery);

    const filtered = receivables
      .filter((r) => r.status !== "paid")
      .filter((r) => {
        if (!q) return true;
        return (
          norm(r.customerName ?? "").includes(q) ||
          norm(r.customerRUC  ?? "").includes(q) ||
          norm(r.invoiceNumber ?? "").includes(q)
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
        va = resolveReceivableDueDate(a) ?? "";
        vb = resolveReceivableDueDate(b) ?? "";
      }
      const cmp = va.localeCompare(vb);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [receivables, searchQuery, sortKey, sortDir]);

  const totalPending = useMemo(
    () => visibleReceivables.reduce((s, r) => s + Number(r.balance || 0), 0).toFixed(2),
    [visibleReceivables]
  );

  const renderStatus = (status?: string) => {
    if (status === "partial") return <span className="text-yellow-600 text-xs font-medium">Parcial</span>;
    if (status === "paid")    return <span className="text-green-600  text-xs font-medium">Cobrado</span>;
    return <span className="text-red-600 text-xs font-medium">Pendiente</span>;
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!entityId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Cuentas por Cobrar</h1>
        <p className="text-sm text-gray-600 mt-1">Selecciona una empresa.</p>
      </div>
    );
  }

  if (loading || accountsLoading) {
    return <p className="p-6">Cargando cuentas por cobrar…</p>;
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">

      {/* HEADER */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cuentas por Cobrar</h1>
          <p className="text-sm text-gray-600">Facturas pendientes de cobro</p>
        </div>
        <button
          onClick={() => navigate("/cartera/historial?type=ar")}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
        >
          🗂️ Vista por grupos
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-500">Total por cobrar</p>
          <p className="text-xl font-bold text-green-700">${totalPending}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-xs text-gray-500">Facturas</p>
          <p className="text-xl font-bold">{visibleReceivables.length}</p>
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
            placeholder="Buscar cliente, RUC o factura…"
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
              <th className="p-3 text-left">Cliente</th>
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
            {visibleReceivables.map((r) => (
              <React.Fragment key={r.id}>
                <tr className="border-t hover:bg-gray-50 transition-colors">
                  <td className="p-3">
                    <div className="font-medium leading-tight">{r.customerName || "Cliente"}</div>
                    <div className="text-xs text-gray-400">{r.customerRUC || "—"}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">{r.invoiceNumber}</td>
                  <td className="p-3 hidden sm:table-cell text-gray-600">{r.issueDate}</td>
                  <td className="p-3 text-right font-semibold">
                    ${Number(r.balance || 0).toFixed(2)}
                  </td>
                  <td className="p-3 hidden md:table-cell text-gray-600">
                    {resolveReceivableDueDate(r) ?? "—"}
                  </td>
                  <td className="p-3">{renderStatus(r.status)}</td>
                  <td className="p-3 space-x-3 whitespace-nowrap">
                    <button
                      className="text-blue-600 text-xs hover:underline"
                      onClick={() => setSelectedReceivable(r)}
                    >
                      Cobrar
                    </button>
                    <button
                      className="text-blue-600 text-xs hover:underline"
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
                      <PayableInstallmentsTable schedule={r.installmentSchedule ?? []} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}

            {visibleReceivables.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  {searchQuery
                    ? `Sin resultados para "${searchQuery}"`
                    : "No existen cuentas por cobrar"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {selectedReceivable && entityId && userIdSafe && (
        <ARPaymentModal
          key={selectedReceivable.id}
          entityId={entityId}
          userId={userIdSafe}
          receivable={selectedReceivable}
          accounts={accounts}
          bankAccounts={bankAccounts}
          onClose={() => setSelectedReceivable(null)}
          onSuccess={reload}
        />
      )}
    </div>
  );
}
