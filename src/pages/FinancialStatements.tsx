// src/pages/FinancialStatements.tsx
import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";

import { useSelectedEntity } from "../context/SelectedEntityContext";
import { useAuth } from "@/context/AuthContext";

import PnLSummary from "../components/PnLSummary";
import BalanceSheet from "../components/BalanceSheet";
import InitialBalancePanel from "../components/financials/InitialBalancePanel";
import TrialBalance from "../components/TrialBalance";
import InitialBalanceViewer from "@/components/financials/InitialBalanceViewer";

import { fetchJournalEntries } from "@/services/journalService";
import { fetchInitialBalances } from "@/services/initialBalanceService";
import { initialBalancesToJournalEntries } from "@/services/initialBalanceAdapter";
import { JournalEntry } from "../types/JournalEntry";
import ECUADOR_COA from "@/../shared/coa/ecuador_coa";
import { hasInitial } from "@/utils/journalGuards";
import ChartOfAccountsModal from "@/components/modals/ChartOfAccountsModal";

type Tab = "comprobacion" | "estado" | "balance";

export default function FinancialStatements() {
  // -------------------------------------------
  // Selected entity context
  // -------------------------------------------
  const { selectedEntity } = useSelectedEntity();
  const { user } = useAuth();

  const entityId = selectedEntity?.id ?? "";
  const entityName = selectedEntity?.name ?? "";
  const entityRuc = selectedEntity?.ruc ?? "";

  const [showInitialPanel, setShowInitialPanel] = useState(false);
  const [editEnabled, setEditEnabled] = useState(false);
  const [securityWord, setSecurityWord] = useState("");
  const [initialEntries, setInitialEntries] = useState<JournalEntry[]>([]); 

  // -------------------------------------------
  // AUTH GUARD (CRITICAL)
  // -------------------------------------------
  if (!user) {
    return (
      <div className="pt-24 px-6 min-h-screen text-center text-red-600">
        ⚠️ Debes iniciar sesión para ver estados financieros.
      </div>
    );
  }

  /* --------------------------------------------------------------------- */
  /* DATA SOURCES                                                           */
  /* --------------------------------------------------------------------- */
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);

  /* --------------------------------------------------------------------- */
  /* UI STATE                                                               */
  /* --------------------------------------------------------------------- */
  const [activeTab, setActiveTab] = useState<Tab>("comprobacion");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showAccountsModal, setShowAccountsModal] = useState(false);

  // ------------------------------------
  // Load entries (currently disabled)
  // ------------------------------------
  useEffect(() => {
  if (!entityId) {
    setInitialEntries([]);
    return;
  }

  let cancelled = false;

  fetchInitialBalances(entityId)
    .then((balances) => {
      if (cancelled) return;
      const adapted = initialBalancesToJournalEntries(balances, entityId);
      setInitialEntries(Array.isArray(adapted) ? adapted : []);
    })
    .catch((err) => {
      console.error("Error loading initial balances:", err);
      if (!cancelled) setInitialEntries([]);
    });

  return () => {
    cancelled = true;
  };
}, [entityId]);

  useEffect(() => {
    if (!entityId) {
      setEntries([]);
      return;
    }
    
    let cancelled = false;
    setLoading(true);

    fetchJournalEntries(entityId)
      .then((data) => {
        if (cancelled) return;
        console.log("Loaded journal entries:", data);
        setEntries(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Error loading journal entries:", err);
        if (!cancelled) setEntries([]);
      })
      .finally(() => { 
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entityId]);

  useEffect(() => {
        console.log("ENTRIES UPDATED:", entries);
      }, [entries]);

  // -------------------------------------------
  // ENTITY-SCOPED ENTRIES
  // -------------------------------------------

  const entityEntries = useMemo(
    () => entries.filter((e) => e.entityId === entityId),
    [entries, entityId]
  );

  // All historical entries: explicit initial balance + all journal lines
  const allHistoricalEntries = useMemo(
    () => [...initialEntries, ...entityEntries],
    [initialEntries, entityEntries]
  );

  /* --------------------------------------------------------------------- */
  /* AUTO-SET START DATE FROM EARLIEST ENTRY                                */
  /* --------------------------------------------------------------------- */

  useEffect(() => {
    if (startDate) return;

    const dates = allHistoricalEntries
      .map((e) => (typeof e.date === "string" ? e.date.slice(0, 10) : ""))
      .filter(Boolean)
      .sort();

    if (dates.length) setStartDate(dates[0]);
  }, [allHistoricalEntries, startDate]);

  /* --------------------------------------------------------------------- */
  /* ACCOUNTING SAFETY FLAG                                                 */
  /* --------------------------------------------------------------------- */

  // True when there is any data to display — explicit initial balance OR
  // any journal entries (we can compute the opening balance from them).
  const hasInitialBalance = useMemo(
    () => initialEntries.length > 0 || hasInitial(entityEntries) || entityEntries.length > 0,
    [initialEntries, entityEntries]
  );

  /* --------------------------------------------------------------------- */
  /* COMPUTED OPENING BALANCE                                               */
  /* Accumulates the net balance of ALL prior entries (initial config +     */
  /* journal entries before startDate) into synthetic "initial" lines.     */
  /* This is how the previous year's closing balance becomes the new year's */
  /* opening balance automatically.                                         */
  /* --------------------------------------------------------------------- */

  const computedOpeningEntries = useMemo((): JournalEntry[] => {
    // Collect entries that fall before the selected period
    const priorEntries = allHistoricalEntries.filter((e) => {
      if (e.source === "initial") return true;          // always include explicit initial
      return startDate ? (e.date ?? "") < startDate : false;
    });

    if (priorEntries.length === 0) return [];

    // Net debit–credit per account
    const netByCode = new Map<string, { name: string; net: number }>();
    for (const e of priorEntries) {
      const code = (e.account_code ?? "").trim();
      if (!code) continue;
      const existing = netByCode.get(code) ?? { name: e.account_name ?? "", net: 0 };
      existing.net += (e.debit ?? 0) - (e.credit ?? 0);
      if (!existing.name && e.account_name) existing.name = e.account_name;
      netByCode.set(code, existing);
    }

    // Convert to synthetic initial entries (source = "initial")
    const result: JournalEntry[] = [];
    for (const [code, { name, net }] of netByCode.entries()) {
      if (Math.abs(net) < 0.001) continue;
      result.push({
        id: `opening-${code}`,
        entityId,
        transactionId: "computed-opening",
        transactionType: "initial_balance",
        documentNature: "opening",
        account_code: code,
        account_name: name,
        date: startDate || "1900-01-01",
        description: "Saldo de apertura (calculado)",
        debit:  net > 0 ?  net : 0,
        credit: net < 0 ? -net : 0,
        source: "initial",
        createdAt: 0,
        updatedAt: 0,
      });
    }

    return result;
  }, [allHistoricalEntries, startDate, entityId]);

  /* --------------------------------------------------------------------- */
  /* PERIOD ENTRIES (movements within the selected date range)              */
  /* --------------------------------------------------------------------- */

  const periodEntries = useMemo(() => {
    return entityEntries.filter((e) => {
      if (e.source === "initial") return false;
      if (startDate && (e.date ?? "") < startDate) return false;
      if (endDate   && (e.date ?? "") > endDate)   return false;
      return true;
    });
  }, [entityEntries, startDate, endDate]);

  /* --------------------------------------------------------------------- */
  /* COMBINED ENTRIES FOR EACH REPORT                                       */
  /* --------------------------------------------------------------------- */

  // Trial Balance & Balance Sheet: opening snapshot + period movements
  const trialBalanceEntries = useMemo(
    () => [...computedOpeningEntries, ...periodEntries],
    [computedOpeningEntries, periodEntries]
  );

  // P&L / Estado de Resultados: only period movements (no balance-sheet opening)
  const filteredPnLEntries = useMemo(
    () => periodEntries.filter((e) => e.source !== "initial"),
    [periodEntries]
  );

  // -------------------------------------------
  // Calculate the PnL result (needed for Balance Sheet)
  // -------------------------------------------
  const resultadoDelEjercicio = useMemo(() => {
    const sum = (prefix: string, side: "debit" | "credit") =>
      filteredPnLEntries
        .filter((e) => (e.account_code || "").startsWith(prefix))
        .reduce((a, e) => a + Number(e[side] || 0), 0);

    return sum("7", "credit") - sum("5", "debit");
  }, [filteredPnLEntries]);

  // ------------------------------------
  // Render the selected tab content
  // ------------------------------------
  const reportContent = useMemo(() => {
  if (loading) {
    return <p className="text-blue-600 animate-pulse">⏳ Cargando registros contables...</p>;
  }

  if (!hasInitialBalance) {
    return (
      <div className="text-center text-amber-600 py-6">
        ⚠️ Debes registrar el <strong>Balance Inicial</strong>
      </div>
    );
  }

  if (activeTab === "comprobacion") {
    return (
      <TrialBalance
        entityId={entityId}
        entries={trialBalanceEntries}
      />
    );
  }

  if (activeTab === "estado") {
    return (
      <PnLSummary
        entries={filteredPnLEntries}
      />
    );
  }

  if (activeTab === "balance") {
    return (
      <BalanceSheet
        entries={trialBalanceEntries}
        entityId={entityId}
        resultadoDelEjercicio={resultadoDelEjercicio}
      />
    );
  }

  return null;
}, [
  activeTab,
  loading,
  hasInitialBalance,
  trialBalanceEntries,
  filteredPnLEntries,
  resultadoDelEjercicio,
  startDate,
  endDate,
  entityId,
]);

  // ------------------------------------
  // If no entity is selected
  // ------------------------------------
  if (!entityId) {
    return (
      <div className="pt-24 px-6 min-h-screen">
        <h1 className="text-2xl font-bold text-blue-700 mb-4">📊 Estados Financieros</h1>
        <p>
          Debes seleccionar una entidad primero en el{" "}
          <Link className="text-blue-600 underline" to="/dashboard">
            Tablero de Entidades
          </Link>.
        </p>
      </div>
    );
  }

  // ------------------------------------
  // RENDER
  // ------------------------------------
  return (
      <div className="min-h-screen">
        <div className="mx-auto w-full max-w-7xl">

         {/* PAGE TITLE */}
          <div className="mb-6 flex items-start justify-between">
            
            {/* Left side: Title + company */}
            <div>
              <h1 className="text-2xl font-bold text-blue-700">
                📊 Estados Financieros
              </h1>
              <p className="text-sm text-gray-600">
                Empresa: <strong>{entityRuc}</strong> — {entityName}
              </p>
            </div>

          </div>

          {/* SALDO INICIAL — quick-access card */}
          <div className={`mb-6 rounded-xl border px-5 py-4 flex items-center justify-between gap-4 ${
            hasInitialBalance
              ? "bg-green-50 border-green-200"
              : "bg-blue-50 border-blue-200"
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{hasInitialBalance ? "✅" : "🏁"}</span>
              <div>
                <p className="font-semibold text-gray-800 text-sm">
                  {hasInitialBalance ? "Saldo inicial configurado" : "Sin saldo inicial"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {hasInitialBalance
                    ? "El balance de apertura está registrado. Puedes editarlo desde la página de Saldo Inicial."
                    : "Configura el saldo de apertura para migrar desde otro sistema contable."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowAccountsModal(true)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 transition"
              >
                Plan de Cuentas
              </button>
              <Link
                to="/saldo-inicial"
                className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                {hasInitialBalance ? "Ver / Editar" : "Configurar →"}
              </Link>
            </div>
          </div>

          {/* BROWSER STYLE TABS */}
          <div className="flex justify-center gap-2 border-b mb-4">
            {[
              { id: "comprobacion", label: "Balance de Comprobación" },
              { id: "estado", label: "Estado de Resultados" },
              { id: "balance", label: "Balance General" }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as Tab)}
                className={`
                  px-4 py-2 rounded-t-md
                  ${activeTab === t.id
                    ? "bg-white border border-b-0 text-blue-700 font-semibold"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"}
                `}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Date filter */}
          <div className="bg-white border rounded-lg shadow-sm p-4 mb-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
              
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-4 lg:p-6 mb-12">
            {reportContent}
          </div>
          {showAccountsModal && entityId && entityName && (
            <ChartOfAccountsModal
              entityId={entityId}
              entityName={entityName}
              onClose={() => setShowAccountsModal(false)}
              onAccountsChanged={() => {
                // Optional: reload account plan if needed
                console.log("Plan de cuentas actualizado");
              }}
            />
          )}
        </div>
      </div>
    );
  }