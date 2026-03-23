// src/pages/BankReconciliationPage.tsx

import React, { useState, useEffect } from "react";
import { fetchEntities } from "../services/entityService";
import { fetchJournalEntries } from "@/services/journalService";
import { fetchBankMovements } from "@/services/bankMovementService";

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
  const [selectedBankId, setSelectedBankId] = useState("");
  const [loading, setLoading] = useState(false);


  // Cargar entidades del usuario
  useEffect(() => {
    if (!user?.uid) return;

    let active = true;

    (async () => {
      try {
        const list = await fetchEntities();
        if (active) setEntities(list);
      } catch (err) {
        console.error("Error fetching entities:", err);
        if (active) setEntities([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.uid]);

  // Cargar datos de conciliación para la entidad seleccionada
  useEffect(() => {
    const entityId = selectedEntity?.id;

    if (!entityId) {
      setJournalEntries([]);
      setBankMovements([]);
      return;
    }

    let active = true;

    (async () => {
      try {
        setLoading(true);

        const [journal, bank] = await Promise.all([
          fetchJournalEntries(entityId),
          fetchBankMovements(
            entityId, 
            selectedBankId || undefined
          ),
        ]);

        if (!active) return;

        setJournalEntries(journal);
        setBankMovements(bank);
      } catch (err) {
        console.error("Error loading reconciliation data:", err);
        if (active) {
          setJournalEntries([]);
          setBankMovements([]);
      }
    } finally {
      if (active) setLoading(false);
    }
    })();

    return () => {
      active = false;
    };
  }, [selectedEntity?.id, selectedBankId]);

  console.log("TYPE:", fetchBankMovements);
  
  /* ======================================================
     Render
  ====================================================== */
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-blue-700 mb-4">
        🧾 Conciliación Bancaria
      </h2>

      {/* ENTITY SELECT */}
      <select
        aria-label="Selecciona una empresa"
        className="p-2 mb-6 border rounded"
        onChange={(e) => {
          const selected = entities.find((x) => x.ruc === e.target.value) || null;
          setSelectedEntity(selected);
          setSelectedBankId("");
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

      {/* LOADING */}
      {loading && (
        <p className="text-gray-500 mb-4">Cargando datos...</p>
      )}

      {/* RECONCILIATION */}
      {selectedEntity && (
        <BankReconciliation
          journalEntries={journalEntries}
          bankMovements={bankMovements}
        />
      )}
    </div>
  );
}