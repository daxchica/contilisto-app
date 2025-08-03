// src/pages/BankBookPage.tsx

import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { v4 as uuidv4 } from "uuid";


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
import { getEntities } from "../services/entityService";

import BankReconciliationTab from "../components/BankReconciliationTab";

type TabView = "libro" | "conciliacion";

type FormState = {
  date?: string;
  payee?: string;
  amount?: string;
  type?: string;
  description?: string;
  relatedTo?: "expense" | "accountsPayable";
  postdated?: boolean;
};

export default function BankBookPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [entries, setEntries] = useState<BankBookEntry[]>([]);
  const [newAccountName, setNewAccountName] = useState("");
  const [form, setForm] = useState<any>({});
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [bankMovements, setBankMovements] = useState<BankMovement[]>([]);
  const [entities, setEntities] = useState<any[]>([]);

  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [tab, setTab] = useState<"libro" | "conciliacion">("libro");

  const auth = getAuth();
  const userId = auth.currentUser?.uid || "";
  
  useEffect(() => {
    if (!userId) return;
    getEntities(userId).then(setEntities);
    fetchBankAccounts(userId).then(setBankAccounts);
  }, [userId]);

  useEffect(() => {
    if (selectedBankId) {
      fetchBankBookEntries(selectedBankId, selectedBankId).then(setEntries);
    }
  }, [selectedBankId]);

  useEffect(() => {
    if (selectedEntityId) {
      fetchJournalEntries(selectedEntityId).then(setJournalEntries);
      fetchBankMovements(selectedEntityId).then(setBankMovements);
    }
  }, [selectedEntityId]);

  const handleAddBankAccount = async () => {
    const newAccount: BankAccount = {
      id: uuidv4(),
      entityId: "default-entity", // replace as needed
      name: newAccountName,
      number: "",
      currency: "USD",
      bankName: "",
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    await createBankAccount(newAccount);
    setBankAccounts((prev) => [...prev, newAccount]);
    setNewAccountName("");
  };

  const handleDeleteBankAccount = async (id: string) => {
    await deleteBankAccount(id);
    setBankAccounts((prev) => prev.filter((b) => b.id !== id));
  };

  const handleAddEntry = async () => {
    if (!form.date || !form.amount || !form.type || !form.relatedTo || !selectedEntityId || !selectedBankId) return;

    const parsedAmount = parseFloat(form.amount);
    const newEntry: BankBookEntry = {
      id: uuidv4(),
      entityId: selectedEntityId,
      bankAccountId: selectedBankId,
      date: form.date,
      amount: parseFloat(form.amount),
      type: form.type,
      payee: form.payee,
      description: form.description,
      status: form.postdated ? "postdated" : "issued",
      relatedTo: form.relatedTo,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    await createBankBookEntry(selectedEntityId, newEntry);
    setEntries((prev) => [...prev, newEntry]);

    // Add to general ledger
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
    

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">
        {tab === "libro" ? "Libro Bancos" : "Conciliacion Bancaria"}
      </h1>

        <div className="mb-4">
            <label>Seleccionar Entidad:</label>
        <select
          className="ml-2 border p-1"
          value={selectedEntityId}
          onChange={(e) => setSelectedEntityId(e.target.value)}
        >
          <option value="">-- Seleccione entidad --</option>
          {entities.map((ent) => (
            <option key={ent.id} value={ent.id}>
              {ent.ruc} – {ent.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex gap-2 border-b">
            <button
            onClick={() => setTab("libro")}
            className={`px-4 py-2 rounded ${
                tab === "libro" ? "bg-white border border-b-0 font-bold" : "bg-gray-200"
            }`}
        >
            Libro Bancos
        </button>
        <button
            onClick={() => setTab("conciliacion")}
            className={`px-4 py-2 rounded-t-md ${
                tab === "conciliacion" ? "bg-white border-b-0 font-bold" : "bg-gray-200"
            }`}
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
            >
              <option value="">-- Seleccione --</option>
              {bankAccounts.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <input
              placeholder="Nuevo Banco"
              className="border p-1 mr-2"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
            />
            <button onClick={handleAddBankAccount} className="bg-blue-600 text-white px-2 py-1 rounded">
              Crear Banco
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold">Nueva Transacción</h2>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <input placeholder="Fecha" type="date" onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <input placeholder="Beneficiario" onChange={(e) => setForm({ ...form, payee: e.target.value })} />
              <input placeholder="Monto" type="number" onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              <select onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="">Tipo Movimiento</option>
                <option value="INGRESO">Ingreso</option>
                <option value="EGRESO">Egreso</option>
                
              </select>
              <input placeholder="Descripción" onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <select onChange={(e) => setForm({ ...form, relatedTo: e.target.value })}>
                <option value="">Relacionado a</option>
                <option value="expense">Gasto</option>
                <option value="accountsPayable">Cuentas por Pagar</option>
              </select>
              <label>
                <input type="checkbox" onChange={(e) => setForm({ ...form, postdated: e.target.checked })} /> Cheque Posfechado
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
        <BankReconciliationTab
            journalEntries={journalEntries}
            bankMovements={bankMovements}
        />
    )}
    </div>
  );
}
