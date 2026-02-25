/**
 * ⚠️ NOTE:
 * This dashboard uses ACCOUNTING data (journal-based).
 * Projected Cash Flow (AR / AP) is handled via installments.
 * Real Cash Flow (bank movements) lives in CashFlowPage.
 */

import React, { useState, useEffect, useMemo } from "react";

import IncomeCard from "../components/dashboard/IncomeCard";
import ExpenseCard from "../components/dashboard/ExpenseCard";
import ProfitCard from "../components/dashboard/ProfitCard";
import ARCard from "../components/dashboard/ARCard";
import APCard from "../components/dashboard/APCard";
import ChartIncomeVsExpenses from "../components/dashboard/ChartIncomeVsExpenses";
import ChartExpensesPie from "../components/dashboard/ChartExpensesPie";
import CashFlowTable from "../components/dashboard/CashFlowTable";

import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { fetchJournalEntries } from "@/services/journalService";
import { getRealCashFlow } from "@/services/cashFlowService";

import { getCashflowForecast } from "@/services/cashflowForecastServices";
import { buildDailyCashFlowSeries } from "@/utils/buildDailyCashFlowSeries";

import { JournalEntry } from "@/types/JournalEntry";
import { CashFlowItem } from "@/types/CashFlow";
import CashFlowChart from "@/components/dashboard/CashFlowChart";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function startsWithSafe(value: unknown, prefix: string): boolean {
  return typeof value === "string" && value.startsWith(prefix);
}

/* ============================================================================
 * COMPONENT
 * ========================================================================== */

const DashboardHome: React.FC = () => {
  const { selectedEntity } = useSelectedEntity();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [projectedCashFlow, setProjectedCashFlow] = useState<CashFlowItem[]>([]);
  const [cashFlowLoading, setCashFlowLoading] = useState(false);

  const [projectedLoading, setProjectedLoading] = useState(false);

  const [realEvents, setRealEvents] = useState<any[]>([]);
  const [realLoading, setRealLoading] = useState(false);


  /* =======================
   * DATE WINDOW
   * ======================= */
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const last30Start = useMemo(() => {
    return todayStart - 29 * 24 * 60 * 60 * 1000;
  }, [todayStart]);

  const todayISO = useMemo(() => {
    return new Date(todayStart).toISOString().slice(0, 10);
  }, [todayStart]);

  const last30ISO = useMemo(() => {
    return new Date(last30Start).toISOString().slice(0, 10);
  }, [last30Start]);

  /* =======================
   * LOAD JOURNAL ENTRIES
   * ======================= */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!selectedEntity?.id) {
        setEntries([]);
        return;
      }

      try {
        const data = await fetchJournalEntries(selectedEntity.id);
        if (!cancelled) setEntries(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setEntries([]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedEntity?.id]);

  /* =======================
   * LOAD PROJECTED CASH FLOW (AR / AP)
   * ======================= */
  useEffect(() => {
    let cancelled = false;

    async function loadProjected() {
      if (!selectedEntity?.id) {
        setProjectedCashFlow([]);
        return;
      }

      setProjectedLoading(true);
      try {
        
        const data = await getCashflowForecast(
        selectedEntity.id,
        last30Start,
        todayStart
      );

        if (!cancelled) {
          setProjectedCashFlow(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (!cancelled) setProjectedCashFlow([]);
      } finally {
        if (!cancelled) setProjectedLoading(false);
      }
    }

    loadProjected();
    return () => {
      cancelled = true;
    };
  }, [selectedEntity?.id, last30Start, todayStart]);

  /* =======================
   * LOAD REAL CASH FLOW (BANK MOVEMENTS) — last 30 days (ISO dates)
   * ======================= */
  useEffect(() => {
    let cancelled = false;

    async function loadReal() {
      if (!selectedEntity?.id) {
        setRealEvents([]);
        return;
      }

      setRealLoading(true);
      try {
        const res = await getRealCashFlow(selectedEntity.id, last30ISO, todayISO);
        if (!cancelled) setRealEvents(Array.isArray(res?.events) ? res.events : []);
      } catch (e) {
        if (!cancelled) setRealEvents([]);
      } finally {
        if (!cancelled) setRealLoading(false);
      }
    }

    loadReal();
    return () => {
      cancelled = true;
    };
  }, [selectedEntity?.id, last30ISO, todayISO]);

  /* =======================
   * ACCOUNTING KPIs
   * ======================= */

  const totalIncome = useMemo(
    () =>
      entries
        .filter((e) => startsWithSafe(e.account_code, "4"))
        .reduce((sum, e) => sum + (e.credit ?? 0), 0),
    [entries]
  );

  const totalExpenses = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            startsWithSafe(e.account_code, "5") ||
            startsWithSafe(e.account_code, "6")
        )
        .reduce((sum, e) => sum + (e.debit ?? 0), 0),
    [entries]
  );

  const profit = totalIncome - totalExpenses;

  /* =======================
   * AR / AP (PROJECTED)
   * ======================= */

  const accountsReceivable = useMemo(() => {
  return entries
    .filter(e => startsWithSafe(e.account_code, "130"))
    .reduce(
      (sum, e) => sum + ((e.debit ?? 0) - (e.credit ?? 0)),
      0
    );
}, [entries]);

  const accountsPayable = useMemo(() => {
  return entries
    .filter(e => startsWithSafe(e.account_code, "20103"))
    .reduce(
      (sum, e) => sum + ((e.credit ?? 0) - (e.debit ?? 0)),
      0
    );
}, [entries]);

  /* =======================
   * CHART DATA
   * ======================= */

  const monthlyIncome = useMemo(() => {
    const out: Record<string, number> = {};
    entries
      .filter((e) => startsWithSafe(e.account_code, "4"))
      .forEach((e) => {
        const month = e.date?.substring(0, 7) ?? "Sin fecha";
        out[month] = (out[month] || 0) + (e.credit ?? 0);
      });
    return out;
  }, [entries]);

  const monthlyExpenses = useMemo(() => {
    const out: Record<string, number> = {};
    entries
      .filter(
        (e) =>
          startsWithSafe(e.account_code, "5") ||
          startsWithSafe(e.account_code, "6")
      )
      .forEach((e) => {
        const month = e.date?.substring(0, 7) ?? "Sin fecha";
        out[month] = (out[month] || 0) + (e.debit ?? 0);
      });
    return out;
  }, [entries]);

  /* =======================
   * DASHBOARD CASH FLOW SERIES (REAL vs PROJECTED) — Daily last 30 days
   * ======================= */
  const cashFlowSeries = useMemo(() => {
    return buildDailyCashFlowSeries({
      realEvents,
      projectedItems: projectedCashFlow,
      days: 30,
      endDateMs: todayStart,
    });
  }, [realEvents, projectedCashFlow, todayStart]);

  const isCashFlowLoading = realLoading || projectedLoading;

  /* =======================
   * RENDER
   * ======================= */

  return (
    <>
      {!selectedEntity?.id ? (
        <div className="mb-6 p-4 bg-yellow-100 text-yellow-800 rounded-lg text-center">
          ⚠️ Selecciona una empresa desde el menú superior para ver resultados.
        </div>
      ) : (
        <div className="mb-6 p-4 bg-blue-50 text-blue-900 rounded-lg text-center font-medium">
          Empresa seleccionada: <strong>{selectedEntity.name}</strong>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
        <IncomeCard value={totalIncome} />
        <ExpenseCard value={totalExpenses} />
        <ProfitCard value={profit} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <ARCard value={accountsReceivable} />
        <APCard value={accountsPayable} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartIncomeVsExpenses
            income={monthlyIncome}
            expenses={monthlyExpenses}
          />
        </div>
        <div>
          <ChartExpensesPie entries={entries} />
        </div>
      </div>

      {/* CASH FLOW GRAPH (REAL vs PROJECTED) */}
      <div className="mb-6 min-h-[320px]">
        <ErrorBoundary>
          <CashFlowChart 
            data={selectedEntity?.id ? cashFlowSeries : []} 
            loading={cashFlowLoading || !selectedEntity?.id}
            title={
              selectedEntity?.id
                ? "Flujo de Caja - Real vs Proyectado (ultimos 30 dias)"
                : "Flujo de caja"
            } 
          />
        </ErrorBoundary>
      </div>
        

      {/* PROJECTED CASH FLOW TABLE (installments) */}
      {isCashFlowLoading ? (
        <div className="p-4 text-center text-gray-500">
          Cargando flujo de caja proyectado…
        </div>
      ) : (
        <CashFlowTable items={projectedCashFlow} />
      )}
    </>
  );
};

export default DashboardHome;