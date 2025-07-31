import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { fetchJournalEntries } from "../services/journalService";
import { JournalEntry } from "../types/JournalEntry";
import { getEntities } from "../services/entityService";
import { exportAccountToPDF } from "../utils/exportUtils";

interface Entity {
  id: string;
  name: string;
  ruc: string;
}

export default function LedgerPage() {
  const auth = getAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [groupedByAccount, setGroupedByAccount] = useState<Record<string, JournalEntry[]>>({});
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);

  // Load user entities
  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    getEntities(auth.currentUser.uid).then(setEntities);
  }, []);

  // Load journal entries for selected entity
  useEffect(() => {
    if (!selectedEntity) return;
    fetchJournalEntries(selectedEntity.id)
      .then(setEntries)
      .catch((err) => {
        console.error("Error al cargar asientos:", err);
        setEntries([]);
      });
  }, [selectedEntity]);

  // Group and sort entries by account
  useEffect(() => {
    if (!entries.length) return;

    const grouped: Record<string, JournalEntry[]> = {};
    const sortedEntries = [...entries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    for (const entry of sortedEntries) {
      if (!grouped[entry.account_code]) {
        grouped[entry.account_code] = [];
      }
      grouped[entry.account_code].push(entry);
    }

    setGroupedByAccount(grouped);
  }, [entries]);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-blue-700 mb-4">📚 Libro Mayor</h2>

      <select
        className="p-2 mb-4 border rounded"
        onChange={(e) => {
          const ent = entities.find((x) => x.ruc === e.target.value);
          setSelectedEntity(ent || null);
        }}
        value={selectedEntity?.ruc || ""}
      >
        <option value="">Selecciona entidad</option>
        {entities.map((ent) => (
          <option key={ent.id} value={ent.ruc}>
            {ent.ruc} - {ent.name}
            </option>
        ))}
      </select>

      {selectedEntity && (
        <p className="mb-4 text-sm text-gray-600">
          Mostrando asientos para: <strong>{selectedEntity.name}</strong>
        </p>
      )}

      {Object.entries(groupedByAccount).map(([code, accountEntries]) => {
        const totalDebits = accountEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
        const totalCredits = accountEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
        const saldoFinal = totalDebits - totalCredits;
      
        return (
          <div key={code} className="mb-6 border rounded p-4 bg-white shadow">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Cuenta: {code} - {accountEntries[0]?.account_name}
            </h3>
            <button
              onClick={() =>
                exportAccountToPDF(code, accountEntries[0]?.account_name || "", accountEntries)
              }
              className="mt-2 px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              📄 Exportar a PDF
            </button>
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Débito</th>
                  <th>Crédito</th>
                </tr>
              </thead>
            <tbody>
              {accountEntries.map((e, i) => (
                <tr key={i} className="border-t">
                  <td>{new Date(e.date).toLocaleDateString("es-EC")}</td>
                  <td>{e.description}</td>
                  <td>
                    {e.debit !== undefined
                      ? e.debit.toLocaleString("es-EC", {minimumFractionDigits: 2 })
                      : "-"}
                      </td>
                  <td>
                    {e.credit !== undefined
                    ? e.credit.toLocaleString("es-EC", { minimumFractionDigits: 2 })
                    : "-"}
                    
                    </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 text-right font-semibold text-gray-700">
              <p>Total Débitos: {" "}
                {totalDebits.toLocaleString("es-EC", {minimumFractionDigits: 2 })}
                </p>
              <p>Total Créditos:{" "}
                {totalCredits.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
              </p>
              <p className={saldoFinal >= 0 ? "text-green-600" : "text-red-600"}>
                Saldo Final:{" "}
                {saldoFinal.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
              </p>
            </div>
        </div>
      );
      
    })}
    </div>
  );
}