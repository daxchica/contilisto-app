// src/pages/BankBookPage.tsx
import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { Link } from "react-router-dom";

import { useSelectedEntity } from "../context/SelectedEntityContext";
import type { BankAccount, BankBookEntry } from "../types/bankTypes";
import type { BankMovement } from "../services/bankMovementService";
import type { JournalEntry } from "../types/JournalEntry";

import {
  fetchBankAccounts,
  createBankAccount,
  deleteBankAccount,
} from "../services/bankAccountService";

import {
  fetchBankBookEntries,
} from "../services/bankBookService";

import { fetchBankMovements } from "../services/bankMovementService";
import { fetchJournalEntries } from "../services/journalService";

import BankReconciliationTab from "../components/BankReconciliationTab";

// ---------------- Helpers ----------------
const fmtUSD = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n);

// ---------------- Modal Types ----------------
interface CreateBankAccountModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { name: string; number: string }) => Promise<void> | void;
}

function CreateBankAccountModal({
  open,
  onClose,
  onConfirm,
}: CreateBankAccountModalProps) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setNumber("");
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !number.trim()) return;
    try {
      setSaving(true);
      await onConfirm({ name: name.trim(), number: number.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-2">Create account</h3>

        <form onSubmit={submit} className="space-y-3">
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Account name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Account number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded border">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------- Main Page ----------------
type TabView = "libro" | "conciliacion";

export default function BankBookPage() {
  const auth = getAuth();
  const userId = auth.currentUser?.uid ?? "";
  const { selectedEntity } = useSelectedEntity();

  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [tab, setTab] = useState<TabView>("libro");

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState("");

  const [entries, setEntries] = useState<BankBookEntry[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [bankMovements, setBankMovements] = useState<BankMovement[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const entityName = selectedEntity?.name ?? "";
  const entityRuc = selectedEntity?.ruc ?? "";

  // Sincronizar entidad seleccionada desde el contexto global
  useEffect(() => {
    setSelectedEntityId(selectedEntity?.id ?? "");
  }, [selectedEntity?.id]);

  // Fetch cuentas bancarias
  useEffect(() => {
    if (!selectedEntity?.id || !userId) {
      setBankAccounts([]);
      setSelectedBankId("");
      return;
    }

    (async () => {
      try {
        const data = await fetchBankAccounts(userId, selectedEntityId);
        data.sort((a, b) => a.name.localeCompare(b.name, "es"));
        setBankAccounts(data);
        // Mantener selección si todavía existe
        setSelectedBankId((prev) =>
          data.some((b) => b.id === prev) ? prev : ""
        );
      } catch (e) {
        console.error("Error fetching bank accounts:", e);
        setBankAccounts([]);
        setSelectedBankId("");
      }
    })();
  }, [selectedEntityId, userId]);

  // Fetch movimientos del libro bancario para la cuenta seleccionada
  useEffect(() => {
    if (!selectedEntity?.id || !selectedBankId) {
      setEntries([]);
      return;
    }

    (async () => {
      try {
        const data = await fetchBankBookEntries(selectedEntityId, selectedBankId);
        setEntries(data);
      } catch (e) {
        console.error("Error fetching bank book entries:", e);
        setEntries([]);
      }
    })();
  }, [selectedEntityId, selectedBankId]);

  // Fetch movimientos bancarios externos (para conciliación)
  useEffect(() => {
    if (!selectedEntityId) {
      setBankMovements([]);
      return;
    }

    fetchBankMovements(selectedEntityId)
      .then(setBankMovements)
      .catch((err) => {
        console.error("Error fetching bank movements:", err);
        setBankMovements([]);
      });
  }, [selectedEntityId]);

  // Fetch journal entries de la entidad (para conciliación)
  useEffect(() => {
    if (!selectedEntity?.id) {
      setJournalEntries([]);
      return;
    }

    (async () => {
      try {
        const data = await fetchJournalEntries(selectedEntityId);
        setJournalEntries(data);
      } catch (err) {
        console.error("Error fetching journal entries for bank book:", err);
        setJournalEntries([]);
      }
    })();
  }, [selectedEntityId]);

  // El usuario aún no ha seleccionado entidad en el dashboard
  if (!selectedEntity?.id) {
    return (
      <div className="pt-20 p-6">
        <h1 className="text-2xl font-bold mb-4">Libro Bancos</h1>
        <p>
          Debes seleccionar una entidad en{" "}
          <Link to="/dashboard" className="text-blue-600 underline">
            Tablero de Entidades
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="pt-20 flex justify-center">
      <div className="w-full max-w-4xl p-4">
        <h1 className="text-2xl font-bold text-center mb-4">
          {tab === "libro" ? "Libro Bancos" : "Conciliación Bancaria"} —{" "}
          {entityRuc} · {entityName}
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
            {/* Selector de cuenta bancaria + botón crear */}
            <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
              <select
                className="border p-2 rounded min-w-[220px]"
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                aria-label="Selecciona una cuenta bancaria"
              >
                <option value="">
                  {bankAccounts.length
                    ? "-- Seleccione una cuenta --"
                    : "No hay cuentas registradas"}
                </option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.number})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                ➕ Crear cuenta
              </button>

              {selectedBankId && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm("¿Eliminar esta cuenta bancaria?")) return;
                    try {
                      await deleteBankAccount(selectedEntityId, selectedBankId);
                      setBankAccounts((prev) =>
                        prev.filter((b) => b.id !== selectedBankId)
                      );
                      setSelectedBankId("");
                      setEntries([]);
                    } catch (err) {
                      console.error("Error deleting bank account:", err);
                      alert("No se pudo eliminar la cuenta.");
                    }
                  }}
                  className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                >
                  🗑 Eliminar cuenta
                </button>
              )}
            </div>

            {/* Tabla de movimientos del libro */}
            <h2 className="text-lg font-semibold mb-2 text-center">
              Movimientos del Libro Bancario
            </h2>

            {!selectedBankId ? (
              <p className="text-gray-600 text-center">
                Selecciona una cuenta para ver sus movimientos.
              </p>
            ) : entries.length === 0 ? (
              <p className="text-gray-600 text-center">
                No hay movimientos registrados para esta cuenta.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-2 py-1">Fecha</th>
                      <th className="border px-2 py-1">Beneficiario</th>
                      <th className="border px-2 py-1">Monto</th>
                      <th className="border px-2 py-1">Tipo</th>
                      <th className="border px-2 py-1">Estado</th>
                      <th className="border px-2 py-1">Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="border px-2 py-1">{entry.date}</td>
                        <td className="border px-2 py-1">{entry.payee}</td>
                        <td className="border px-2 py-1 text-right">
                          {fmtUSD(entry.amount)}
                        </td>
                        <td className="border px-2 py-1">{entry.type}</td>
                        <td className="border px-2 py-1">{entry.status}</td>
                        <td className="border px-2 py-1">{entry.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <CreateBankAccountModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onConfirm={async ({ name, number }) => {
            if (!userId || !selectedEntity?.id) return;

            await createBankAccount({
              entityId: selectedEntityId,
              name,
              number,
              currency: "USD",
              bankName: "",
              userId,
            });

            const updated = await fetchBankAccounts(userId, selectedEntityId);
            updated.sort((a, b) => a.name.localeCompare(b.name, "es"));
            setBankAccounts(updated);
            setShowCreateModal(false);
          }}
        />
      </div>
    </div>
  );
}