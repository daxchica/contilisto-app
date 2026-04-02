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
import { filterEntries } from "@/utils/filterEntries";

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

  const allEntries = useMemo(
    () => [...initialEntries, ...entityEntries],
    [initialEntries, entityEntries]
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

  /* --------------------------------------------------------------------- */
  /* FILTERED ENTRIES
  /* --------------------------------------------------------------------- */
  
  const filteredAllEntries = useMemo(() => {
  return filterEntries(allEntries, {
    startDate,
    endDate,
    excludeInitial: false,
  });
}, [allEntries, startDate, endDate]);

const filteredPnLEntries = useMemo(() => {
  return filteredAllEntries.filter((e) => e.source !== "initial");
}, [filteredAllEntries]);

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
        entries={filteredAllEntries}
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
        entries={filteredAllEntries}
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
  filteredAllEntries,
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

          </div>

          {/* INITIAL BALANCE PANEL */}
          
          {/* INITIAL BALANCE CONTROLS */}
          <div className="mb-6 bg-white border rounded-lg shadow-sm p-4">

            {/* ACTION BAR */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3">
              
              <button
                onClick={() => setShowInitialPanel((v) => !v)}
                className="
                  bg-blue-600 hover:bg-blue-700 
                  text-white px-4 py-2 rounded-lg
                  transition font-medium
                  w-full sm:w-auto
                  "
              >
                {showInitialPanel ? "Ocultar" : "Mostrar Balance Inicial"}
              </button>

              <button
                onClick={() => setShowAccountsModal(true)}
                className="
                  bg-emerald-600 hover:bg-emerald-700 
                  text-white px-4 py-2 rounded-lg
                  transition font-medium
                  w-full sm:w-auto
                  "
              >
                Ver Plan de Cuentas
              </button>
            </div>

            {/* WARNING */}
            {hasInitialBalance && (
              <div className="bg-amber-100 border border-amber-300 text-amber-700 px-4 py-2 rounded mb-3">
                ⚠️ Ya existe un Balance Inicial para esta entidad.
                <div className="text-sm mt-1">
                  Puedes visualizarlo o desbloquear para editarlo.
                </div>
              </div>
            )}

            {/* 👁️ VIEW MODE (ALWAYS CLEAN) */}
            {hasInitialBalance && showInitialPanel && !editEnabled && (
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-2">
                  🔒 Balance Inicial (solo lectura)
                </div>

                <InitialBalanceViewer entries={entityEntries} />
              </div>
            )}

            {/* 🔐 SECURITY */}
            {hasInitialBalance && showInitialPanel && !editEnabled && (
              <div className="mb-4">
                <p className="text-sm mb-2">
                  Para editar el balance escribe: <b>CONFIRMAR</b>
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={securityWord}
                    onChange={(e) => setSecurityWord(e.target.value)}
                    className="border px-3 py-2 rounded w-64"
                  />

                  <button
                    onClick={() => {
                      if (securityWord === "CONFIRMAR") {
                        setEditEnabled(true);
                        setShowInitialPanel(true);

                        // 🔥 force panel open inside child
                        setTimeout(() => {
                          const event = new CustomEvent("force-open-initial-panel");
                          window.dispatchEvent(event);
                        }, 50);

                      } else {
                        alert("Palabra incorrecta");
                      }
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded"
                  >
                    Desbloquear
                  </button>
                </div>
              </div>
            )}

            {/* ✏️ EDIT MODE */}
            {showInitialPanel && editEnabled && (
              <InitialBalancePanel
                entityId={entityId}
                userIdSafe={user.uid}
                accounts={ECUADOR_COA}
                editMode={editEnabled}
              />
            )}

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