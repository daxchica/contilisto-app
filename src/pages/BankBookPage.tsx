// src/pages/BankBookPage.tsx
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import { useSelectedEntity } from "../context/SelectedEntityContext";
import type { BankAccount, BankBookEntry } from "../types/bankTypes";
import type { BankMovement } from "@/types/bankTypes";
import type { JournalEntry } from "../types/JournalEntry";

import { fetchBankBookEntries } from "../services/bankBookService";
import { fetchBankMovements } from "../services/bankMovementService";
import { fetchJournalEntries } from "../services/journalService";
import { fetchBankAccountsFromCOA, createSubAccountUnderParent, deleteCOAAccount } from "@/services/coaService";

import BankReconciliationTab from "../components/BankReconciliationTab";


// ---------------- Helpers ----------------
const fmtUSD = (n: number) =>
  new Intl.NumberFormat("es-EC", { 
    style: "currency", 
    currency: "USD" 
  }).format(n);

type TabView = "libro" | "conciliacion";

export default function BankBookPage() {
  const { selectedEntity } = useSelectedEntity();
  const [showTransfer, setShowTransfer] = useState(false);
  
  const entityId = selectedEntity?.id ?? "";
  const entityName = selectedEntity?.name ?? "";
  const entityRuc = selectedEntity?.ruc ?? "";

  const [tab, setTab] = useState<TabView>("libro");

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState("");

  const [entries, setEntries] = useState<BankBookEntry[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [bankMovements, setBankMovements] = useState<BankMovement[]>([]);

  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);

  
  /* ---------------- FETCH BANK ACCOUNTS ---------------- */

  useEffect(() => {
    if (!entityId) {
      setBankAccounts([]);
      setSelectedBankId("");
      return;
    }

    const load = async () => {
      setLoadingAccounts(true);
      try {
        const data = await fetchBankAccountsFromCOA(entityId);
        setBankAccounts(data);
      // Optional UX: auto-select first account if none selected
        if (!selectedBankId && data.length > 0 && data[0]?.id) {
          setSelectedBankId(data[0].id);
        }
      } catch (e) {
        console.error("Error loading bank accounts", e);
        setBankAccounts([]);
        setSelectedBankId("");
      } finally {
        setLoadingAccounts(false);
      }
    };

    load();
  }, [entityId]);

  /* ---------------- FETCH BOOK ENTRIES ---------------- */

  useEffect(() => {
    if (!entityId || !selectedBankId) {
      setEntries([]);
      return;
    }

    const load = async () => {
      setLoadingEntries(true);
      try {
        const data = await fetchBankBookEntries(
          entityId,
          selectedBankId
        );
        setEntries(data);
      } finally {
        setLoadingEntries(false);
      }
    };

    load();
  }, [entityId, selectedBankId]);

  // ---------------------------------------------------------------------------
  // If selectedBankId no longer exists, reset
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedBankId) return;
    const stillExists = bankAccounts.some((b) => b.id === selectedBankId);
    if (!stillExists) setSelectedBankId("");
  }, [bankAccounts, selectedBankId]);

  // ---------------------------------------------------------------------------
  // Fetch book entries (legacy book view)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!entityId || !selectedBankId) {
      setEntries([]);
      return;
    }

    const load = async () => {
      setLoadingEntries(true);
      try {
        const data = await fetchBankBookEntries(entityId, selectedBankId);
        setEntries(data);
      } catch (e) {
        console.error("Error loading bank book entries", e);
        setEntries([]);
      } finally {
        setLoadingEntries(false);
      }
    };

    load();
  }, [entityId, selectedBankId]);


  /* ---------------- FETCH MOVEMENTS ---------------- */

  useEffect(() => {
    if (!entityId || !selectedBankId) {
      setBankMovements([]);
      return;
    }

    fetchBankMovements(entityId, selectedBankId)
      .then(setBankMovements)
      .catch((e) => {
        console.error("Error loading bank movements", e);
        setBankMovements([]);
      });
  }, [entityId, selectedBankId]);

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
  if (!name || !name.trim()) return;

  const accountCode = await createSubAccountUnderParent(
    entityId,
    "1010103",
    name.trim()
  );

  const updated = await fetchBankAccountsFromCOA(entityId);
  setBankAccounts(updated);

  // Select by DOC ID (since select uses value={b.id})
    const created = updated.find((b) => b.code === accountCode);
    if (created?.id) setSelectedBankId(created.id);
  };

  useEffect(() => {
  console.log("===== BANK BOOK DEBUG =====");
  console.log("selectedEntity:", selectedEntity);
  console.log("entityId:", entityId);
}, [selectedEntity]);
  /* ================= NO ENTITY ================= */

  if (!entityId) {
    return (
      <div className="pt-20 p-6">
        <h1 className="text-2xl font-bold mb-4">Libro Bancos</h1>
        <p>
          Debes seleccionar una entidad en{" "}
          <Link to="/dashboard" className="text-blue-600 underline">
            Tablero de Entidades
          </Link>
        </p>
      </div>
    );
    console.log("Entity ID in BankBookPage", entityId);
  }

  /* ================= RENDER ================= */

  return (
    <div className="pt-20 flex justify-center">
      <div className="w-full max-w-4xl p-4">

        <h1 className="text-2xl font-bold text-center mb-4">
          {tab === "libro"
            ? "Libro Bancos"
            : "Conciliación Bancaria"}{" "}
          — {entityRuc} · {entityName}
        </h1>

        {/* Tabs */}
        <div className="mb-4 flex justify-center gap-2 border-b">
          <button
            onClick={() => setTab("libro")}
            className={`px-4 py-2 rounded-t ${
              tab === "libro"
                ? "bg-white border border-b-0 font-bold"
                : "bg-gray-200"
            }`}
          >
            Libro Bancos
          </button>

          <button
            onClick={() => setTab("conciliacion")}
            className={`px-4 py-2 rounded-t ${
              tab === "conciliacion"
                ? "bg-white border border-b-0 font-bold"
                : "bg-gray-200"
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
            {/* Selector */}
            <div className="mb-6 flex gap-3 justify-center">
              <select
                className="border p-2 rounded min-w-[220px]"
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
              >
                <option value="">
                  {bankAccounts.length
                    ? "-- Seleccione una cuenta --"
                    : "No hay cuentas registradas"}
                </option>

                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} ({b.name})
                  </option>
                ))}
              </select>

              <button
                onClick={handleCreateAccount}
                className="px-3 py-2 bg-blue-600 text-white rounded"
              >
                ➕ Crear cuenta
              </button>

              <button
                onClick={() => setShowTransfer(true)}
                className="px-3 py-2 bg-purple-600 text-white rounded"
              >
                🔁 Transferencia
              </button>

              {selectedBankId && (
                <button
                  onClick={async () => {
                  const selected = bankAccounts.find(b => b.id === selectedBankId);
                  if (!selected) return;

                  await deleteCOAAccount(entityId, selected.code);

                  setSelectedBankId("");
                  const updated = await fetchBankAccountsFromCOA(entityId);
                  setBankAccounts(updated);
                }}
                  className="px-3 py-2 bg-red-600 text-white rounded"
                >
                  🗑 Eliminar
                </button>
              )}
            </div>

            {/* Table */}
            {entries.length === 0 ? (
              <p className="text-center text-gray-600">
                No hay movimientos registrados.
              </p>
            ) : (
              <table className="w-full border text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-2 py-1">Fecha</th>
                    <th className="border px-2 py-1">Beneficiario</th>
                    <th className="border px-2 py-1">Monto</th>
                    <th className="border px-2 py-1">Tipo</th>
                    <th className="border px-2 py-1">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="border px-2 py-1">{entry.date}</td>
                      <td className="border px-2 py-1">{entry.payee}</td>
                      <td className="border px-2 py-1 text-right">{fmtUSD(entry.amount)}</td>
                      <td className="border px-2 py-1">{entry.type}</td>
                      <td className="border px-2 py-1">{entry.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}