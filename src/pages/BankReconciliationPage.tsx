// src/pages/BankReconciliationPage.tsx

import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { fetchEntities } from "../services/entityService";
import { fetchJournalEntries } from "../services/journalService";
import { fetchBankMovements } from "../services/bankMovementService";
import { JournalEntry } from "../types/JournalEntry";
import { BankMovement } from "../types/BankMovement";
import BankReconciliation from "../components/BankReconciliation";

interface Entity {
  id: string;
  name: string;
  ruc: string;
}

export default function BankReconciliationPage() {
  const auth = getAuth();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [journalEntries, setSessionJournalEntries] = useState<JournalEntry[]>([]);
  const [bankMovements, setBankMovements] = useState<BankMovement[]>([]);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    fetchEntities(auth.currentUser.uid).then(setEntities);
  }, []);

  useEffect(() => {
    if (!selectedEntity) return;

    fetchJournalEntries(selectedEntity.id).then(setSessionJournalEntries);
    fetchBankMovements(selectedEntity.id).then(setBankMovements);
  }, [selectedEntity]);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-blue-700 mb-4">
        🧾 Conciliación Bancaria
      </h2>

      <select
        aria-label="Selecciona una entidad"
        className="p-2 mb-6 border rounded"
        onChange={(e) => {
          const ent = entities.find((x) => x.ruc === e.target.value);
          setSelectedEntity(ent || null);
        }}
        value={selectedEntity?.ruc || ""}
      >
        <option value="">Selecciona una entidad</option>
        {entities.map((ent) => (
          <option key={ent.id} value={ent.ruc}>
            {ent.ruc} – {ent.name}
          </option>
        ))}
      </select>

      {selectedEntity && (
        <BankReconciliation
          journalEntries={journalEntries}
          bankMovements={bankMovements}
        />
      )}
    </div>
  );
}