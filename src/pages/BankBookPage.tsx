// src/pages/BankBookPage.tsx

import React, { useState, useEffect, useMemo } from "react";
import { getAuth } from "firebase/auth";
import { v4 as uuidv4 } from "uuid";
import { useSelectedEntity } from "../context/SelectedEntityContext";

import { BankAccount, BankBookEntry } from "../types/BankTypes";
import { JournalEntry } from "../types/JournalEntry";
import { BankMovement } from "../types/BankMovement";

import {
  fetchBankAccounts,
  createBankAccount,
  deleteBankAccount,
} from "../services/bankAccountService";
import {
  fetchBankBookEntries,
  createBankBookEntry,
} from "../services/bankBookService";
import {
  fetchJournalEntries,
  saveJournalEntries,
} from "../services/journalService";
import { fetchBankMovements } from "../services/bankMovementService";

import BankReconciliationTab from "../components/BankReconciliationTab";
import { Link } from "react-router-dom";

type TabView = "libro" | "conciliacion";

type FormState = {
  date?: string;
  payee?: string;
  amount?: string;
  type?: "INGRESO" | "EGRESO" | "";
  description?: string;
  relatedTo?: "expense" | "accountsPayable" | "";
  postdated?: boolean;
};

export default function BankBookPage() {
  
  const auth = getAuth();
  const userId = auth.currentUser?.uid ?? "";

  const { entity } = useSelectedEntity();

  // Mirror entity id locally, but only when it actually changes
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  useEffect(() => {
    const newId = entity?.id ?? "";
    setSelectedEntityId((prev) => (prev !== newId ? newId : prev));
  }, [entity?.id]);

  
  const [tab, setTab] = useState<TabView>("libro");
  
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [entries, setEntries] = useState<BankBookEntry[]>([]);
  const [form, setForm] = useState<FormState>({});
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [bankMovements, setBankMovements] = useState<BankMovement[]>([]);
  const [newAccountName, setNewAccountName] = useState("");
  
  const entityName = useMemo(() => entity?.name ?? "", [entity?.name]);
  const entityRuc = useMemo(() => entity?.ruc ?? "", [entity?.ruc]);

  // Load bank accounts when entity changes
  useEffect(() => {
    if (!userId || !selectedEntityId) {
      setBankAccounts([]);
      setSelectedBankId("");
      return;
    }
    (async () => {
      const data = await fetchBankAccounts(userId, selectedEntityId);
      setBankAccounts(data);
      // keep selected bank if still present; otherwise clear
      setSelectedBankId((prev) => (data.some((b) => b.id === prev) ? prev : ""));
    })();
  }, [userId, selectedEntityId]);

  // Load bank book entries for (entity, bank) pair
  useEffect(() => {
    if (!selectedEntityId || !selectedBankId) {
      setEntries([]);
      return;
    }
    (async () => {
      const data = await fetchBankBookEntries(selectedEntityId, selectedBankId);
      setEntries(data);
    })();
  }, [selectedEntityId, selectedBankId]);

  // Load reconciliation sources when entity changes
  useEffect(() => {
    if (!selectedEntityId) {
      setJournalEntries([]);
      setBankMovements([]);
      return;
    }
    fetchJournalEntries(selectedEntityId).then(setJournalEntries).catch(console.error);
    fetchBankMovements(selectedEntityId).then(setBankMovements).catch(console.error);
  }, [selectedEntityId]);

  // Handlers
  const handleAddBankAccount = async () => {
    if (!userId) return alert("Inicia sesión para continuar.");
    if (!selectedEntityId || !newAccountName.trim())
      return alert("Selecciona entidad y escribe un nombre para el banco.");

    const exists = bankAccounts.some(
      (b) => b.name.trim().toLowerCase() === newAccountName.trim().toLowerCase()
    );
    if (exists) return alert("Ya existe un banco con ese nombre.");

    await createBankAccount({
      id: uuidv4(),
      entityId: selectedEntityId,
      name: newAccountName.trim(),
      number: "",
      currency: "USD",
      bankName: "",
      createdBy: userId,
      userId,
      createdAt: new Date().toISOString(),
    });

    const refreshed = await fetchBankAccounts(userId, selectedEntityId);
    setBankAccounts(refreshed);
    const created = refreshed.find(
      (b) => b.name.trim().toLowerCase() === newAccountName.trim().toLowerCase()
    );
    if (!selectedBankId && created) setSelectedBankId(created.id);
    setNewAccountName("");
    alert("Banco creado exitosamente.");
  };

  const handleDeleteBankAccount = async (id: string) => {
    if (!selectedEntityId) return;
    await deleteBankAccount(selectedEntityId, id);
    setBankAccounts((prev) => prev.filter((b) => b.id !== id));
    if (selectedBankId === id) setSelectedBankId("");
  };

  const handleAddEntry = async () => {
    if (!userId) return alert("Inicia sesión para continuar.");
    const { date, amount, type, relatedTo } = form;
    if (!date || !amount || !type || !relatedTo || !selectedEntityId || !selectedBankId)
      return alert("Completa todos los campos obligatorios.");

    const amountNumber = parseFloat(amount as string);
    if (!isFinite(amountNumber) || amountNumber <= 0)
      return alert("El monto debe ser un número positivo.");

    const newEntry: BankBookEntry = {
      id: uuidv4(),
      entityId: selectedEntityId,
      bankAccountId: selectedBankId,
      date,
      amount: amountNumber,
      type: type as BankBookEntry["type"],
      payee: form.payee || "",
      description: form.description || "",
      status: form.postdated ? "postdated" : "issued",
      relatedTo,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    await createBankBookEntry(selectedEntityId, newEntry, userId); // <-- pass userId
    setEntries((prev) => [...prev, newEntry]);

    const journalEntry: JournalEntry = {
      date: newEntry.date,
      description: newEntry.description,
      account_code: newEntry.relatedTo === "expense" ? "60.01.01" : "21.01.01",
      account_name: newEntry.relatedTo === "expense" ? "Gastos varios" : "Proveedores",
      debit: newEntry.relatedTo === "expense" ? newEntry.amount : 0,
      credit: newEntry.relatedTo === "accountsPayable" ? newEntry.amount : 0,
      type: newEntry.relatedTo === "expense" ? "expense" : "liability",
      userId,
    };
    await saveJournalEntries(selectedEntityId, [journalEntry], userId);
  };

  // If no entity is selected (user didn’t pick one on the dashboard)
  if (!selectedEntityId) {
    return (
      <div className="pt-20 p-6">
        <h1 className="text-2xl font-bold mb-4">Libro Bancos</h1>
        <p className="mb-4">
          Debes seleccionar una entidad primero en el{" "}
          <Link className="text-blue-600 underline" to="/dashboard">
            Tablero de Entidades
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="pt-20 p-4">
      <h1 className="text-2xl font-bold mb-4">
        {tab === "libro" ? "Libro Bancos" : "Conciliación Bancaria"} — {entityRuc} · {entityName}
      </h1>

      <div className="mb-4 flex gap-2 border-b">
        <button
          onClick={() => setTab("libro")}
          className={`px-4 py-2 rounded ${tab === "libro" ? "bg-white border border-b-0 font-bold" : "bg-gray-200"}`}
        >
          Libro Bancos
        </button>
        <button
          onClick={() => setTab("conciliacion")}
          className={`px-4 py-2 rounded-t-md ${tab === "conciliacion" ? "bg-white border-b-0 font-bold" : "bg-gray-200"}`}
        >
          Conciliación bancaria
        </button>
      </div>

      {tab === "libro" && (
        <>
          <div className="mb-4">
            <label>Seleccionar Banco:</label>
            <select
              className="ml-2 border p-1"
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              disabled={!bankAccounts.length}
            >
              <option value="">-- Seleccione --</option>
              {bankAccounts.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6 flex gap-2">
            <input
              placeholder="Nuevo Banco"
              className="border p-1 mr-2"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              aria-label="Nombre del nuevo banco"
            />
            <button
              onClick={handleAddBankAccount}
              disabled={!newAccountName.trim()}
              className={`px-2 py-1 rounded text-white ${
                !newAccountName.trim() ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              Crear Banco
            </button>
          </div>

          {/* Nueva Transacción */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Nueva Transacción</h2>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <input
                placeholder="Fecha"
                type="date"
                value={form.date ?? ""}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
              <input
                placeholder="Beneficiario"
                value={form.payee ?? ""}
                onChange={(e) => setForm({ ...form, payee: e.target.value })}
              />
              <input
                placeholder="Monto"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={form.amount ?? ""}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
              <select
                aria-label="Tipo de movimiento"
                value={form.type ?? ""}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                required
              >
                <option value="">Tipo Movimiento</option>
                <option value="INGRESO">Ingreso</option>
                <option value="EGRESO">Egreso</option>
              </select>
              <input
                placeholder="Descripción"
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <select
                aria-label="Relacionado a"
                value={form.relatedTo ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    relatedTo: e.target.value as FormState["relatedTo"],
                  })
                }
                required
              >
                <option value="">Relacionado a</option>
                <option value="expense">Gasto</option>
                <option value="accountsPayable">Cuentas por Pagar</option>
              </select>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!form.postdated}
                  onChange={(e) => setForm({ ...form, postdated: e.target.checked })}
                />{" "}
                Cheque Posfechado
              </label>
            </div>

            <button onClick={handleAddEntry} className="mt-3 bg-green-600 text-white px-4 py-2 rounded">
              Agregar Entrada
            </button>
          </div>

          <h2 className="text-xl font-semibold mb-2">Movimientos</h2>
          <table className="w-full border">
            <thead>
              <tr className="bg-gray-200">
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
                  <td className="border px-2 py-1">${entry.amount.toFixed(2)}</td>
                  <td className="border px-2 py-1">{entry.type}</td>
                  <td className="border px-2 py-1">{entry.status}</td>
                  <td className="border px-2 py-1">{entry.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === "conciliacion" && (
        <BankReconciliationTab journalEntries={journalEntries} bankMovements={bankMovements} />
      )}
    </div>
  );
}
