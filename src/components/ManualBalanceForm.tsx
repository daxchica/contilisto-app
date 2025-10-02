// components/ManualBalanceForm.tsx
import React, { useState } from "react";
import { saveInitialBalances } from "../services/initialBalanceService";

export interface Entry {
  account_code: string;
  account_name: string;
  debit?: number;
  credit?: number;
}

interface Props {
  onSubmit: (entries: Entry[]) => void;
  entityId: string;
}

export default function ManualBalanceForm({ onSubmit, entityId }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [newEntry, setNewEntry] = useState<Entry>({
    account_code: "",
    account_name: "",
    debit: 0,
    credit: 0,
  });

  const handleChange = (field: keyof Entry, value: string | number) => {
    setNewEntry((prev) => ({ ...prev, [field]: value }));
  };

  const addEntry = () => {
    if (newEntry.account_code && newEntry.account_name) {
      setEntries((prev) => [...prev, newEntry]);
      setNewEntry({ account_code: "", account_name: "", debit: 0, credit: 0 });
    }
  };

  const handleSave = async () => {
    try {
      const formatted = entries.map((e) => ({
        account_code: e.account_code,
        account_name: e.account_name,
        initial_balance: (e.debit || 0) - (e.credit || 0),
      }));

      await saveInitialBalances(entityId, formatted);

      alert("✅ Balance Inicial guardado correctamente");

      onSubmit(entries); // puedes usarlo para cerrar modal o recargar
    } catch (error) {
      console.error("❌ Error al guardar el balance inicial:", error);
      alert("❌ No se pudo guardar el balance inicial.");
    }
  };

  return (
    <div className="p-4 border rounded mb-4">
      <h3 className="font-semibold mb-2">Carga Manual</h3>
      <div className="flex gap-2 mb-2">
        <input
          placeholder="Account Code"
          className="border p-2 rounded"
          value={newEntry.account_code}
          onChange={(e) => handleChange("account_code", e.target.value)}
        />
        <input
          placeholder="Account Name"
          className="border p-2 rounded"
          value={newEntry.account_name}
          onChange={(e) => handleChange("account_name", e.target.value)}
        />
        <input
          placeholder="Debit"
          type="number"
          className="border p-2 rounded"
          value={newEntry.debit}
          onChange={(e) => handleChange("debit", Number(e.target.value))}
        />
        <input
          placeholder="Credit"
          type="number"
          className="border p-2 rounded"
          value={newEntry.credit}
          onChange={(e) => handleChange("credit", Number(e.target.value))}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={addEntry}
        >
          ➕ Add
        </button>
      </div>
      <button
        className="mt-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        onClick={handleSave}
      >
        ✅ Enviar Balance Inicial
      </button>
    </div>
  );
}