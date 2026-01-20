import React, { useState, useEffect, useMemo } from "react";

import IncomeCard from "../components/dashboard/IncomeCard";
import ExpenseCard from "../components/dashboard/ExpenseCard";
import ProfitCard from "../components/dashboard/ProfitCard";
import ARCard from "../components/dashboard/ARCard";
import APCard from "../components/dashboard/APCard";
import ChartIncomeVsExpenses from "../components/dashboard/ChartIncomeVsExpenses";
import ChartExpensesPie from "../components/dashboard/ChartExpensesPie";

import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { fetchJournalEntries } from "@/services/journalService";
import { JournalEntry } from "@/types/JournalEntry";

/* ============================================================================
 * SAFETY HELPERS — UI NEUTRAL
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

  /* =======================
   * LOAD ENTRIES
   * ======================= */
  useEffect(() => {
    const load = async () => {
      if (!selectedEntity?.id) {
        setEntries([]);
        return;
      }
      const data = await fetchJournalEntries(selectedEntity.id);
      setEntries(Array.isArray(data) ? data : []);
    };
    load();
  }, [selectedEntity?.id]);

  /* =======================
   * DERIVED VALUES
   * ======================= */

  const totalIncome = useMemo(() => {
    return entries
      .filter(e => startsWithSafe(e.account_code, "4"))
      .reduce((sum, e) => sum + (e.credit || 0), 0);
  }, [entries]);

  const totalExpenses = useMemo(() => {
    return entries
      .filter(
        e =>
          startsWithSafe(e.account_code, "5") ||
          startsWithSafe(e.account_code, "6")
      )
      .reduce((sum, e) => sum + (e.debit || 0), 0);
  }, [entries]);

  const profit = totalIncome - totalExpenses;

  const accountsReceivable = useMemo(() => {
    return entries
      .filter(e => startsWithSafe(e.account_code, "113"))
      .reduce(
        (sum, e) => sum + ((e.debit || 0) - (e.credit || 0)),
        0
      );
  }, [entries]);

  const accountsPayable = useMemo(() => {
    return entries
      .filter(
        e =>
          startsWithSafe(e.account_code, "20103") ||
          startsWithSafe(e.account_code, "20104") ||
          startsWithSafe(e.account_code, "20105")
      )
      .reduce(
        (sum, e) => sum + ((e.credit || 0) - (e.debit || 0)),
        0
      );
  }, [entries]);

  const monthlyIncome = useMemo(() => {
    const out: Record<string, number> = {};
    entries
      .filter(e => startsWithSafe(e.account_code, "4"))
      .forEach(e => {
        const month = e.date?.substring(0, 7) ?? "Sin fecha";
        out[month] = (out[month] || 0) + (e.credit || 0);
      });
    return out;
  }, [entries]);

  const monthlyExpenses = useMemo(() => {
    const out: Record<string, number> = {};
    entries
      .filter(
        e =>
          startsWithSafe(e.account_code, "5") ||
          startsWithSafe(e.account_code, "6")
      )
      .forEach(e => {
        const month = e.date?.substring(0, 7) ?? "Sin fecha";
        out[month] = (out[month] || 0) + (e.debit || 0);
      });
    return out;
  }, [entries]);

  /* =======================
   * RENDER — UNCHANGED UI
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
    </>
  );
};

export default DashboardHome;