// src/pages/BankBookPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { getAuth } from "firebase/auth";
import { v4 as uuidv4 } from "uuid";
import { Link } from "react-router-dom";

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

/* ----------------------- Small local helpers ----------------------- */
const fmtUSD = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(
    n
  );

/* ------------------------- Local modal UI -------------------------- */
function CreateBankAccountModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { name: string; number: string }) => Promise<void> | void;
}) {
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-account-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="create-account-title" className="text-lg font-semibold mb-2">
          Create account
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Enter the account details to add it to this entity.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="acctName" className="block text-sm font-medium">
              Account name
            </label>
            <input
              id="acctName"
              className="mt-1 w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div>
            <label htmlFor="acctNumber" className="block text-sm font-medium">
              Account number
            </label>
            <input
              id="acctNumber"
              className="mt-1 w-full border rounded px-3 py-2"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border hover:bg-gray-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* --------------------------- Page types ---------------------------- */
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

/* ============================ Page ================================ */
export default function BankBookPage() {
  const auth = getAuth();
  const userId = auth.currentUser?.uid ?? "";
  const { entity } = useSelectedEntity();

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
  const [journalEntries, setSessionJournalEntries] = useState<JournalEntry[]>([]);
  const [bankMovements, setBankMovements] = useState<BankMovement[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const entityName = useMemo(() => entity?.name ?? "", [entity?.name]);
  const entityRuc = useMemo(() => entity?.ruc ?? "", [entity?.ruc]);

  /* ---------------------- Load bank accounts ---------------------- */
  useEffect(() => {
    const load = async () => {
      if (!userId || !selectedEntityId) {
        setBankAccounts([]);
        setSelectedBankId("");
        return;
      }
      try {
        setLoadingAccounts(true);
        const data = await fetchBankAccounts(userId, selectedEntityId);
        data.sort((a, b) => a.name.localeCompare(b.name, "es"));
        setBankAccounts(data);
        setSelectedBankId((prev) =>
          data.some((b) => b.id === prev) ? prev : ""
        );
      } catch (err) {
        console.error("Error fetching bank accounts:", err);
        setBankAccounts([]);
      } finally {
        setLoadingAccounts(false);
      }
    };
    load();
  }, [userId, selectedEntityId]);

  /* --------------- Load bank book entries for account ------------- */
  useEffect(() => {
    const load = async () => {
      if (!selectedEntityId || !selectedBankId) {
        setEntries([]);
        return;
      }
      try {
        setLoadingEntries(true);
        const data = await fetchBankBookEntries(selectedEntityId, selectedBankId);
        setEntries(data);
      } catch (err) {
        console.error("Error fetching bank book entries:", err);
        setEntries([]);
      } finally {
        setLoadingEntries(false);
      }
    };
    load();
  }, [selectedEntityId, selectedBankId]);

  /* ---------------- Load reconciliation sources ------------------- */
  useEffect(() => {
    if (!selectedEntityId) {
      setSessionJournalEntries([]);
      setBankMovements([]);
      return;
    }
    fetchJournalEntries(selectedEntityId)
      .then(setSessionJournalEntries)
      .catch(console.error);
    fetchBankMovements(selectedEntityId)
      .then(setBankMovements)
      .catch(console.error);
  }, [selectedEntityId]);

  /* ---------------------------- Actions --------------------------- */
  const handleDeleteBankAccount = useCallback(
    async (id: string) => {
      if (!selectedEntityId) return;
      try {
        await deleteBankAccount(selectedEntityId, id);
        setBankAccounts((prev) => prev.filter((b) => b.id !== id));
        if (selectedBankId === id) setSelectedBankId("");
      } catch (err) {
        console.error("Error deleting bank account:", err);
        alert("No se pudo eliminar la cuenta.");
      }
    },
    [selectedEntityId, selectedBankId]
  );

  const handleAddEntry = useCallback(async () => {
    if (!userId) return alert("Inicia sesión para continuar.");
    const { date, amount, type, relatedTo } = form;
    if (
      !date ||
      !amount ||
      !type ||
      !relatedTo ||
      !selectedEntityId ||
      !selectedBankId
    )
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

    try {
      await createBankBookEntry(selectedEntityId, newEntry, userId);
      setEntries((prev) => [...prev, newEntry]);

      // Optional journal mirror
      const journalEntry: JournalEntry = {
        date: newEntry.date,
        description: newEntry.description,
        account_code:
          newEntry.relatedTo === "expense" ? "60.01.01" : "21.01.01",
        account_name:
          newEntry.relatedTo === "expense" ? "Gastos varios" : "Proveedores",
        debit: newEntry.relatedTo === "expense" ? newEntry.amount : 0,
        credit:
          newEntry.relatedTo === "accountsPayable" ? newEntry.amount : 0,
        type: newEntry.relatedTo === "expense" ? "expense" : "liability",
        userId,
      };
      await saveJournalEntries(selectedEntityId, [journalEntry], userId);

      setForm((prev) => ({ ...prev, amount: "", description: "" }));
    } catch (err) {
      console.error("Error creating bank book entry:", err);
      alert("No se pudo guardar la transacción.");
    }
  }, [form, selectedBankId, selectedEntityId, userId]);

  /* ------------------------ No entity selected -------------------- */
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

  /* ------------------------------ UI ------------------------------ */
  return (
    <div className="pt-20 flex justify-center">
      <div className="w-full max-w-4xl p-4">
        <h1 className="text-2xl font-bold mb-4 text-center">
          {tab === "libro" ? "Libro Bancos" : "Conciliación Bancaria"} —{" "}
          {entityRuc} · {entityName}
        </h1>

        {/* Tabs */}
        <div className="mb-4 flex justify-center gap-2 border-b">
          <button
            onClick={() => setTab("libro")}
            className={`px-4 py-2 rounded ${
              tab === "libro"
                ? "bg-white border border-b-0 font-bold"
                : "bg-gray-200"
            }`}
          >
            Libro Bancos
          </button>
          <button
            onClick={() => setTab("conciliacion")}
            className={`px-4 py-2 rounded-t-md ${
              tab === "conciliacion"
                ? "bg-white border-b-0 font-bold"
                : "bg-gray-200"
            }`}
          >
            Conciliación bancaria
          </button>
        </div>

        {tab === "libro" ? (
          <>
            {/* Account selector + Create */}
            <div className="mb-6 flex justify-center items-center gap-3">
              <label htmlFor="bankSelect" className="sr-only">
                Seleccionar Banco
              </label>
              <select
                id="bankSelect"
                className="border p-2 rounded"
                aria-label="Selecciona un banco"
                title="Selecciona un banco"
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                disabled={!bankAccounts.length || loadingAccounts}
              >
                <option value="">
                  {loadingAccounts ? "Cargando…" : "-- Seleccione --"}
                </option>
                {bankAccounts.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Create account
              </button>
            </div>

            <CreateBankAccountModal
              open={showCreateModal}
              onClose={() => setShowCreateModal(false)}
              onConfirm={async ({ name, number }) => {
                if (!userId || !selectedEntityId) return;

                const exists = bankAccounts.some(
                  (b) => b.name.trim().toLowerCase() === name.toLowerCase()
                );
                if (exists) {
                  alert("Ya existe una cuenta con ese nombre.");
                  return;
                }

                await createBankAccount({
                  entityId: selectedEntityId,
                  name,
                  number,
                  currency: "USD",
                  bankName: "",
                  createdBy: userId,
                  userId,
                });

                const refreshed = await fetchBankAccounts(
                  userId,
                  selectedEntityId
                );
                refreshed.sort((a, b) =>
                  a.name.localeCompare(b.name, "es")
                );
                setBankAccounts(refreshed);

                const created = refreshed.find(
                  (b) => b.name.trim().toLowerCase() === name.toLowerCase()
                );
                if (created?.id) setSelectedBankId(created.id);

                setShowCreateModal(false);
                alert("Cuenta creada exitosamente.");
              }}
            />

            {/* Nueva Transacción (centered block) */}
            <div className="flex justify-center">
              <div className="w-full max-w-lg">
                <h2 className="text-xl font-semibold mb-4 text-center">
                  Nueva Transacción
                </h2>

                <div className="space-y-4">
                  <input
                    id="txDate"
                    placeholder="Fecha"
                    type="date"
                    className="w-full border rounded px-3 py-2"
                    value={form.date ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, date: e.target.value })
                    }
                  />

                  <input
                    id="txPayee"
                    placeholder="Beneficiario"
                    className="w-full border rounded px-3 py-2"
                    value={form.payee ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, payee: e.target.value })
                    }
                  />

                  <input
                    id="txAmount"
                    placeholder="Monto"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    className="w-full border rounded px-3 py-2"
                    value={form.amount ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                  />

                  <select
                    id="txType"
                    aria-label="Tipo de movimiento"
                    className="w-full border rounded px-3 py-2"
                    value={form.type ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        type: (e.target.value || "") as FormState["type"],
                      }))
                    }
                    required
                  >
                    <option value="">Tipo Movimiento</option>
                    <option value="INGRESO">Ingreso</option>
                    <option value="EGRESO">Egreso</option>
                  </select>

                  <input
                    id="txDesc"
                    placeholder="Descripción"
                    className="w-full border rounded px-3 py-2"
                    value={form.description ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />

                  <select
                    id="txRelated"
                    aria-label="Relacionado a"
                    className="w-full border rounded px-3 py-2"
                    value={form.relatedTo ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        relatedTo: e.target
                          .value as FormState["relatedTo"],
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
                      onChange={(e) =>
                        setForm({ ...form, postdated: e.target.checked })
                      }
                    />
                    Cheque Posfechado
                  </label>

                  <button
                    onClick={handleAddEntry}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                    disabled={!selectedBankId}
                  >
                    Agregar Entrada
                  </button>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-semibold mt-8 mb-2 text-center">
              Movimientos
            </h2>

            {!selectedBankId ? (
              <p className="text-gray-600 text-center">
                Selecciona una cuenta bancaria para ver sus movimientos.
              </p>
            ) : loadingEntries ? (
              <p className="text-blue-600 animate-pulse text-center">
                Cargando movimientos…
              </p>
            ) : entries.length === 0 ? (
              <p className="text-gray-600 text-center">
                No hay movimientos en esta cuenta.
              </p>
            ) : (
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
                      <td className="border px-2 py-1">
                        {fmtUSD(entry.amount)}
                      </td>
                      <td className="border px-2 py-1">{entry.type}</td>
                      <td className="border px-2 py-1">{entry.status}</td>
                      <td className="border px-2 py-1">{entry.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <BankReconciliationTab
            journalEntries={journalEntries}
            bankMovements={bankMovements}
          />
        )}
      </div>
    </div>
  );
}