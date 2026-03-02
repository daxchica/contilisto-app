// src/pages/FinancialStatements.tsx
import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";

import { useSelectedEntity } from "../context/SelectedEntityContext";
import { useAuth } from "@/context/AuthContext";

import PnLSummary from "../components/PnLSummary";
import BalanceSheet from "../components/BalanceSheet";
import InitialBalancePanel from "../components/financials/InitialBalancePanel";
import TrialBalance from "../components/TrialBalance";

import { fetchJournalEntries } from "@/services/journalService";
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

  /* --------------------------------------------------------------------- */
  /* AUTO-SET START DATE FROM INITIAL BALANCE                               */
  /* --------------------------------------------------------------------- */

  useEffect(() => {
    if (!entityEntries.length) return;
    if (startDate) return;

    const initialDate = entityEntries
      .filter(
        (e) => e.source === "initial" && typeof e.date === "string")  
        .map((e) => e.date!.slice(0, 10))
        .sort()[0];

    if (initialDate) {
      setStartDate(initialDate);
    }
  }, [entityEntries, startDate]);

  /* --------------------------------------------------------------------- */
  /* ACCOUNTING SAFETY FLAGS                                                */
  /* --------------------------------------------------------------------- */

  const hasInitialBalance = useMemo(
    () => hasInitial(entityEntries),
    [entityEntries]
  );

  /* --------------------------------------------------------------------- */
  /* PNL SHOULD IGNORE INITIAL ENTRIES            */
  /* --------------------------------------------------------------------- */
  
  const pnlEntries = useMemo(
    () => entityEntries.filter((e) => e.source !== "initial"),
    [entityEntries]
  );
  
  // -------------------------------------------
  // Calculate the PnL result (needed for Balance Sheet)
  // -------------------------------------------
  const resultadoDelEjercicio = useMemo(() => {
  const sum = (prefix: string, side: "debit" | "credit") =>
    pnlEntries
      .filter((e) => (e.account_code || "").startsWith(prefix))
      .reduce((a, e) => a + Number(e[side] || 0), 0);
  
  return sum("7", "credit") - sum("5", "debit");
}, [pnlEntries]);

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
          entries={entityEntries}
          startDate={startDate}
          endDate={endDate} 
        />
      );
    }

    if (activeTab === "estado") {
      return <PnLSummary entries={pnlEntries} />;
    }

    if (activeTab === "balance") {
        return (
          <BalanceSheet 
            entries={entityEntries} 
            entityId={entityId}
            startDate={startDate}
            endDate={endDate}
          />
        );
      }
    
      return null; 
    }, [
      activeTab,
      loading,
      hasInitialBalance,
      entityEntries,
      pnlEntries,
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
      <div className="pt-16 px-4 lg:px-6 min-h-screen bg-gray-50">
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

            {/* Right side: Button */}
            <button
              onClick={() => setShowAccountsModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition"
            >
              Ver Plan de Cuentas
            </button>

          </div>

          {/* INITIAL BALANCE PANEL */}
          
          <div className="mb-6">            
            <InitialBalancePanel 
              entityId={entityId} 
              userIdSafe={user.uid}
              accounts={ECUADOR_COA}
            />
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
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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