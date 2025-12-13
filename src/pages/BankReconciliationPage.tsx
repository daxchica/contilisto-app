// src/pages/BankReconciliationPage.tsx

import React, { useState, useEffect } from "react";
import { fetchEntities, fetchJournalEntries } from "../services/entityService";
import { fetchBankMovements } from "../services/bankMovementService";

import type { Entity } from "../types/Entity";
import type { JournalEntry } from "../types/JournalEntry";
import type { BankMovement } from "../types/bankTypes";

import BankReconciliation from "../components/BankReconciliation";
import { useAuth } from "@/context/AuthContext";

export default function BankReconciliationPage() {
  const { user } = useAuth();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [bankMovements, setBankMovements] = useState<BankMovement[]>([]);

  // Cargar entidades del usuario
  useEffect(() => {
    if (!user?.uid) return;

    (async () => {
      try {
        const list = await fetchEntities(user.uid);
        setEntities(list);
      } catch (err) {
        console.error("Error fetching entities:", err);
        setEntities([]);
      }
    })();
  }, [user?.uid]);

  // Cargar datos de conciliación para la entidad seleccionada
  useEffect(() => {
    const entityIdSafe = selectedEntity?.id ?? "";

    if (!entityIdSafe) {
      setJournalEntries([]);
      setBankMovements([]);
      return;
    }

    (async () => {
      try {
        const [journal, bank] = await Promise.all([
          fetchJournalEntries(entityIdSafe),
          fetchBankMovements(entityIdSafe),
        ]);

        setJournalEntries(journal);
        setBankMovements(bank);
      } catch (err) {
        console.error("Error loading reconciliation data:", err);
        setJournalEntries([]);
        setBankMovements([]);
      }
    })();
  }, [selectedEntity]);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-blue-700 mb-4">
        🧾 Conciliación Bancaria
      </h2>

      <select
        aria-label="Selecciona una empresa"
        className="p-2 mb-6 border rounded"
        onChange={(e) => {
          const ent = 
            entities.find((x) => x.ruc === e.target.value) || null;
          setSelectedEntity(ent);
        }}
        value={selectedEntity?.ruc || ""}
      >
        <option value="">Selecciona una empresa</option>
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