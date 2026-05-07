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
import { getRealCashFlow } from "@/services/cashFlowRealService";

import { getCashflowForecast } from "@/services/cashFlowForecastService";
import { buildDailyCashFlowSeries } from "@/utils/buildDailyCashFlowSeries";

import { JournalEntry } from "@/types/JournalEntry";
import { CashFlowItem } from "@/types/CashFlow";
import CashFlowChart from "@/components/dashboard/CashFlowChart";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

// ============================================================================
// HELPERS
// ============================================================================

function startsWithSafe(value: unknown, prefix: string): boolean {
  return typeof value === "string" && value.startsWith(prefix);
}

// ============================================================================
// PERIOD HELPERS
// ============================================================================

type PeriodKey = "year" | "last30" | "all";

function toLocalISODate(ms: number) {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getPeriodBounds(key: PeriodKey): { from: string; to: string; label: string } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayISO = toLocalISODate(now.getTime());

  if (key === "last30") {
    const from = toLocalISODate(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    return { from, to: todayISO, label: `Últimos 30 días` };
  }
  if (key === "year") {
    const from = `${now.getFullYear()}-01-01`;
    return { from, to: todayISO, label: `Año ${now.getFullYear()}` };
  }
  // "all"
  return { from: "", to: todayISO, label: "Todo el período" };
}

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "year",   label: "Este año" },
  { key: "last30", label: "Últimos 30 días" },
  { key: "all",    label: "Todo" },
];

// ============================================================================
// COMPONENT
// ============================================================================

const DashboardHome: React.FC = () => {
  const { selectedEntity } = useSelectedEntity();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [projectedCashFlow, setProjectedCashFlow] = useState<CashFlowItem[]>([]);
  const [cashFlowLoading, setCashFlowLoading] = useState(false);

  const [projectedLoading, setProjectedLoading] = useState(false);

  const [realEvents, setRealEvents] = useState<any[]>([]);
  const [realLoading, setRealLoading] = useState(false);

  // Period selector
  const [periodKey, setPeriodKey] = useState<PeriodKey>("year");
  const period = useMemo(() => getPeriodBounds(periodKey), [periodKey]);

  /* =======================
   * DATE WINDOW (for cash flow charts — always last 30 days)
   * ======================= */
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const last30Start = useMemo(() => {
    return todayStart - 29 * 24 * 60 * 60 * 1000;
  }, [todayStart]);

  const todayISO = useMemo(() => toLocalISODate(todayStart), [todayStart]);
  const last30ISO = useMemo(() => toLocalISODate(last30Start), [last30Start]);

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
   * PERIOD-FILTERED ENTRIES (for P&L KPIs)
   * ======================= */

  const periodEntries = useMemo(() => {
    if (!period.from) return entries; // "all" — no filter
    return entries.filter((e) => {
      if (!e.date) return false;
      return e.date >= period.from && e.date <= period.to;
    });
  }, [entries, period]);

  /* =======================
   * ACCOUNTING KPIs (filtered by period)
   * ======================= */

  const totalIncome = useMemo(() => {
    return periodEntries
      .filter((e) => startsWithSafe(e.account_code, "4"))
      .reduce((sum, e) => sum + ((e.credit ?? 0) - (e.debit ?? 0)), 0);
  }, [periodEntries]);

  const totalExpenses = useMemo(() => {
    return periodEntries
      .filter(
        (e) => startsWithSafe(e.account_code, "5") || startsWithSafe(e.account_code, "6")
      )
      .reduce((sum, e) => sum + ((e.debit ?? 0) - (e.credit ?? 0)), 0);
  }, [periodEntries]);

  const profit = totalIncome - totalExpenses;

  /* =======================
   * AR / AP — running balance (all-time, not period-filtered)
   * ======================= */

  const AR_CODE = "101030101"; // Clientes nacionales
  const AP_CODE = "201030102"; // Proveedores locales

  const accountsReceivable = useMemo(() => {
    return entries
      .filter((e) => e.account_code === AR_CODE)
      .reduce((sum, e) => sum + ((e.debit ?? 0) - (e.credit ?? 0)), 0);
  }, [entries]);

  const accountsPayable = useMemo(() => {
    return entries
      .filter((e) => e.account_code === AP_CODE)
      .reduce((sum, e) => sum + ((e.credit ?? 0) - (e.debit ?? 0)), 0);
  }, [entries]);

  /* =======================
   * CHART DATA
   * ======================= */

  const monthlyIncome = useMemo(() => {
    const out: Record<string, number> = {};
    periodEntries
      .filter((e) => startsWithSafe(e.account_code, "4"))
      .forEach((e) => {
        const month = e.date?.substring(0, 7) ?? "Sin fecha";
        const net = (e.credit ?? 0) - (e.debit ?? 0);
        out[month] = (out[month] || 0) + net;
      });
    return out;
  }, [periodEntries]);

  const monthlyExpenses = useMemo(() => {
    const out: Record<string, number> = {};
    periodEntries
      .filter((e) => startsWithSafe(e.account_code, "5") || startsWithSafe(e.account_code, "6"))
      .forEach((e) => {
        const month = e.date?.substring(0, 7) ?? "Sin fecha";
        const net = (e.debit ?? 0) - (e.credit ?? 0);
        out[month] = (out[month] || 0) + net;
      });
    return out;
  }, [periodEntries]);

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
      {/* PERIOD SELECTOR */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPeriodKey(opt.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                periodKey === opt.key
                  ? "bg-white shadow text-blue-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">
          {period.from
            ? `${period.from} → ${period.to}`
            : `Hasta ${period.to}`}
        </span>
      </div>

      {/* KPI CARDS — 2 cols on mobile, 3 on tablet, 5 on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-6">
        <IncomeCard value={totalIncome} />
        <ExpenseCard value={totalExpenses} />
        <ProfitCard value={profit} />
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
          <ChartExpensesPie entries={periodEntries} />
        </div>
      </div>

      {/* CASH FLOW GRAPH (REAL vs PROJECTED) */}
      <div className="mb-6">
        <ErrorBoundary>
          <CashFlowChart 
            data={selectedEntity?.id ? cashFlowSeries : []} 
            loading={isCashFlowLoading || !selectedEntity?.id}
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
