// src/pages/BankBookPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";

import { useSelectedEntity } from "../context/SelectedEntityContext";
import type { BankAccount, BankBookEntry } from "../types/bankTypes";
import type { BankMovement } from "@/types/bankTypes";
import type { JournalEntry } from "../types/JournalEntry";

import { fetchBankBookEntries } from "../services/bankBookService";
import { fetchBankMovements } from "@/services/bankMovementService";
import { fetchJournalEntries } from "../services/journalService";
import { 
  fetchBankAccountsFromCOA, 
  createSubAccountUnderParent, 
  deleteCOAAccount 
} from "@/services/coaService";

import BankReconciliationTab from "../components/BankReconciliationTab";
import TransferBetweenBanksModal from "@/components/bank/TransferBetweenBanksModal";
import { useAuth } from "@/context/AuthContext";


// ---------------- Helpers ----------------
const fmtUSD = (n: number) =>
  new Intl.NumberFormat("es-EC", { 
    style: "currency", 
    currency: "USD" 
  }).format(n);

type TabView = "libro" | "conciliacion";

export default function BankBookPage() {
  const { selectedEntity } = useSelectedEntity();
  
  const entityId = selectedEntity?.id ?? "";
  const entityName = selectedEntity?.name ?? "";
  const entityRuc = selectedEntity?.ruc ?? "";
  const { user } = useAuth();
  const userId = user?.uid ?? "";

  const [tab, setTab] = useState<TabView>("libro");

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankCode, setSelectedBankCode] = useState("");

  const [entries, setEntries] = useState<BankBookEntry[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [bankMovements, setBankMovements] = useState<BankMovement[]>([]);

  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const [showTransfer, setShowTransfer] = useState(false);

  /* ================= REFRESH CENTRALIZED ================= */

  const refreshData = useCallback(async () => {
    if (!entityId || !selectedBankCode) return;

    try {
      const [movements, book] = await Promise.all([
        fetchBankMovements(
          entityId, 
          selectedBankCode
        ),
        fetchBankBookEntries(entityId, selectedBankCode),
      ]);

      setBankMovements(movements);
      setEntries(book);
    } catch (e) {
      console.error("Error refreshing data", e);
    }
  }, [entityId, selectedBankCode]);

  /* ---------------- FETCH BANK ACCOUNTS ---------------- */

  useEffect(() => {
    if (!entityId) {
      setBankAccounts([]);
      setSelectedBankCode("");
      return;
    }

    const load = async () => {
      setLoadingAccounts(true);
      try {
        const data = await fetchBankAccountsFromCOA(entityId);
        
        const mapped: BankAccount[] = data.map((acc: any) => ({
          id: acc.id ?? acc.code, // fallback if no id
          entityId,
          account_code: acc.code,
          code: String(acc.code),
          name: String(acc.name ?? ""),
        }));

        setBankAccounts(mapped);

      // Optional UX: auto-select first account if none selected
        if (!selectedBankCode && mapped.length > 0) {
          setSelectedBankCode(mapped[0].code);
        }
      } catch (e) {
        console.error("Error loading bank accounts", e);
        setBankAccounts([]);
        setSelectedBankCode("");
      } finally {
        setLoadingAccounts(false);
      }
    };

    load();
  }, [entityId]);

  /* ---------------- FETCH BOOK ENTRIES ---------------- */

  useEffect(() => {
    if (!entityId || !selectedBankCode) {
      setEntries([]);
      return;
    }

    const load = async () => {
      setLoadingEntries(true);
      try {
        const data = await fetchBankBookEntries(
          entityId,
          selectedBankCode
        );
        setEntries(data);
      } catch (e) {
        console.error("Error loading bank book entries", e);
        setEntries([]);
      } finally {
        setLoadingEntries(false);
      }
    };

    load();
  }, [entityId, selectedBankCode]);

  // ---------------------------------------------------------------------------
  // Validate Selection
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedBankCode) return;

    const exists = bankAccounts.some(
      (b) => b.code === selectedBankCode);

    if (!exists) setSelectedBankCode("");
  }, [bankAccounts, selectedBankCode]);

  /* ---------------- FETCH MOVEMENTS ---------------- */

  useEffect(() => {
    if (!entityId || !selectedBankCode) {
      setBankMovements([]);
      return;
    }

    fetchBankMovements(
      entityId, 
      selectedBankCode
    )
      .then(setBankMovements)
      .catch((e) => {
        console.error("Error loading bank movements", e);
        setBankMovements([]);
      });
  }, [entityId, selectedBankCode]);

  /* ---------------- FETCH JOURNAL ---------------- */

  useEffect(() => {
    if (!entityId || tab !== "conciliacion") {
      setJournalEntries([]);
      return;
    }

    fetchJournalEntries(entityId)
      .then(setJournalEntries)
      .catch((e) => {
        console.error("Error loading journal entries", e);
        setJournalEntries([]);
      });
  }, [entityId, tab]);


  /* ================= CREATE ACCOUNT ================= */

  const handleCreateAccount = async () => {
    if (!entityId) return;

    const name = prompt("Nombre del banco:");
    if (!name?.trim()) return;

    const accountCode = await createSubAccountUnderParent(
      entityId,
      "1010103",
      name.trim()
    );

    const updated = await fetchBankAccountsFromCOA(entityId);

    const mapped: BankAccount[] = updated.map((acc: any) => ({
      id: acc.id ?? acc.code,
      entityId,
      account_code: acc.code,
      code: acc.code,
      name: acc.name,
    }))

    setBankAccounts(mapped);

  // Select by DOC ID (since select uses value={b.id})
    const created = mapped.find((b) => b.code === accountCode);
    if (created?.code) setSelectedBankCode(created.code);
  };

  /* ================= NO ENTITY ================= */

  if (!entityId) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Libro Bancos</h1>
        <p>
          Debes seleccionar una entidad en{" "}
          <Link to="/dashboard" className="text-blue-600 underline">
            Tablero de Entidades
          </Link>
        </p>
      </div>
    );
  }

  /* ================= RENDER ================= */

  return (
    <div className="w-full">
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-4">

        {/* HEADER */}
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-blue-700">
            {tab === "libro" ? "🏦 Libro Bancos" : "🔍 Conciliación Bancaria"}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 truncate">
            {entityName}{entityRuc ? ` — ${entityRuc}` : ""}
          </p>
        </div>

        {/* TABS */}
        <div className="mb-4 flex gap-1 border-b">
          <button
            onClick={() => setTab("libro")}
            className={`px-3 sm:px-4 py-2 text-sm rounded-t font-medium transition ${
              tab === "libro"
                ? "bg-white border border-b-0 border-gray-200 text-blue-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Libro Bancos
          </button>

          <button
            onClick={() => setTab("conciliacion")}
            className={`px-3 sm:px-4 py-2 text-sm rounded-t font-medium transition ${
              tab === "conciliacion"
                ? "bg-white border border-b-0 border-gray-200 text-blue-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Conciliación
          </button>
        </div>

        {tab === "conciliacion" ? (
          <BankReconciliationTab
            journalEntries={journalEntries}
            bankMovements={bankMovements}
          />
        ) : (
          <>
            {/* CONTROLS — wraps on mobile */}
            <div className="mb-4 flex flex-wrap gap-2 items-center">
              {/* Account selector — full width on mobile, auto on larger */}
              <select
                className="border p-2 rounded text-sm w-full sm:w-auto sm:flex-1 sm:max-w-xs"
                value={selectedBankCode}
                onChange={(e) => setSelectedBankCode(e.target.value)}
              >
                <option value="">
                  {bankAccounts.length
                    ? "— Seleccione una cuenta —"
                    : "No hay cuentas registradas"}
                </option>

                {bankAccounts.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>

              {/* Action buttons — wrap naturally */}
              <button
                onClick={handleCreateAccount}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded whitespace-nowrap"
              >
                ➕ Crear
              </button>

              <button
                onClick={() => setShowTransfer(true)}
                className="px-3 py-2 text-sm bg-purple-600 text-white rounded whitespace-nowrap"
              >
                🔁 Transferir
              </button>

              {selectedBankCode && (
                <button
                  onClick={async () => {
                    const selected = bankAccounts.find(b => b.code === selectedBankCode);
                    if (!selected) return;
                    await deleteCOAAccount(entityId, selected.code);
                    setSelectedBankCode("");
                    const updated = await fetchBankAccountsFromCOA(entityId);
                    const mapped: BankAccount[] = updated.map((acc: any) => ({
                      id: acc.id ?? acc.code,
                      entityId,
                      account_code: acc.code,
                      code: acc.code,
                      name: acc.name,
                    }));
                    setBankAccounts(mapped);
                  }}
                  className="px-3 py-2 text-sm bg-red-600 text-white rounded whitespace-nowrap"
                >
                  🗑 Eliminar
                </button>
              )}
            </div>

            {/* TABLE */}
            {entries.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No hay movimientos registrados.
              </p>
            ) : (
              <div className="bg-white rounded-xl shadow overflow-x-auto">
                <table className="w-full text-sm min-w-[320px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Fecha</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Descripción</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">Monto</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap hidden sm:table-cell">Saldo</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 hidden md:table-cell">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const isCredit = entry.type === "in" || entry.type === "deposit";
                      return (
                        <tr key={entry.id} className="border-t hover:bg-gray-50 transition">
                          <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">
                            {entry.date}
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-800 leading-tight">
                              {entry.payee || "—"}
                            </p>
                            {entry.reference && (
                              <p className="text-xs text-gray-400 leading-tight mt-0.5">
                                Ref: {entry.reference}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                            <span className={isCredit ? "text-green-700" : "text-red-600"}>
                              {isCredit ? "+" : ""}{fmtUSD(entry.amount)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap hidden sm:table-cell">
                            <span className={entry.balance < 0 ? "text-red-600" : "text-gray-700"}>
                              {fmtUSD(entry.balance)}
                            </span>
                          </td>
                          <td className="px-3 py-2 hidden md:table-cell">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              entry.status === "Conciliado"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}>
                              {entry.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {showTransfer && (
          <TransferBetweenBanksModal
            isOpen={showTransfer}
            entityId={entityId}
            userIdSafe={userId}
            bankAccounts={bankAccounts}
            onClose={() => setShowTransfer(false)}
            onSaved={refreshData}
          />
        )}

      </div>
    </div>
  );
}