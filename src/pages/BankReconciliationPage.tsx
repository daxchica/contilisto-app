// src/pages/BankReconciliationPage.tsx

import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getEntities } from "../services/entityService";
import { fetchJournalEntries } from "../services/journalService";
import { fetchBankMovements } from "../services/bankMovementService";
import BankReconciliation from "../components/BankReconciliation";
import { JournalEntry } from "../types/JournalEntry";
import { BankMovement } from "../types/BankMovement";

interface Entity {
  id: string;
  name: string;
  ruc: string;
}

export default function BankReconciliationPage() {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [bankMovements, setBankMovements] = useState<BankMovement[]>([]);
  const [loading, setLoading] = useState(false);

  // Load entities for the user
  useEffect(() => {
    if (!currentUser?.uid) return;

    getEntities(currentUser.uid).then((data) => {
      setEntities(data);
      if (data.length > 0) setSelectedEntity(data[0]);
    });
  }, [currentUser]);

  // Load data for selected entity
  useEffect(() => {
    if (!selectedEntity) return;
    console.log("Retching for entity::", selectedEntity.id);

    setLoading(true);
    Promise.all([
      fetchJournalEntries(selectedEntity.id),
      fetchBankMovements(selectedEntity.id),
    ])
      .then(([entries, movements]) => {
        console.log("Entries:", entries);
        console.log("Movements:", movements);
        setJournalEntries(entries);
        setBankMovements(movements);
      })
      .finally(() => setLoading(false));
  }, [selectedEntity]);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-blue-700 mb-6">
        🧾 Conciliación Bancaria
      </h1>

      <div className="mb-6 max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Selecciona una entidad
        </label>
        <select
          value={selectedEntity?.ruc || ""}
          onChange={(e) =>
            setSelectedEntity(
              entities.find((ent) => ent.ruc === e.target.value) || null
            )
          }
          className="p-2 border rounded w-full"
        >
          {entities.map((entity) => (
            <option key={entity.id} value={entity.ruc}>
              {entity.ruc} – {entity.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-blue-600 animate-pulse">⏳ Cargando datos...</p>
      ) : (
        <BankReconciliation
          journalEntries={journalEntries}
          bankMovements={bankMovements}
        />
      )}
    </div>
  );
}