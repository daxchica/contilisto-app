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

import { JournalEntry } from "@/types/JournalEntry";
import { CashFlowItem } from "@/types/CashFlow";

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

  /* =======================
   * DATE WINDOW (90 DAYS)
   * ======================= */
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const ninetyDaysFromNow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }, []);

  /* =======================
   * LOAD JOURNAL ENTRIES
   * ======================= */
  useEffect(() => {
    if (!selectedEntity?.id) {
      setEntries([]);
      return;
    }

    fetchJournalEntries(selectedEntity.id)
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch(() => setEntries([]));
  }, [selectedEntity?.id]);

  /* =======================
   * LOAD PROJECTED CASH FLOW (AR / AP)
   * ======================= */
  useEffect(() => {
    if (!selectedEntity?.id) {
      setProjectedCashFlow([]);
      return;
    }

    setCashFlowLoading(true);

    getRealCashFlow(selectedEntity.id, today, ninetyDaysFromNow)
      .then((data) =>
        setProjectedCashFlow(Array.isArray(data) ? data : [])
      )
      .catch(() => setProjectedCashFlow([]))
      .finally(() => setCashFlowLoading(false));
  }, [selectedEntity?.id, today, ninetyDaysFromNow]);

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
    return projectedCashFlow
      .filter((i) => i.type === "AR" && i.status !== "paid")
      .reduce((sum, i) => sum + i.amount, 0);
  }, [projectedCashFlow]);

  const accountsPayable = useMemo(() => {
    return projectedCashFlow
      .filter((i) => i.type === "AP" && i.status !== "paid")
      .reduce((sum, i) => sum + i.amount, 0);
  }, [projectedCashFlow]);

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

      {cashFlowLoading ? (
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