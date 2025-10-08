// src/pages/LedgerPage.tsx

import React, { useEffect, useState, useMemo } from "react";
import { useSelectedEntity } from "../context/SelectedEntityContext";
import { fetchJournalEntries } from "../services/journalService";
import { JournalEntry } from "../types/JournalEntry";
import { exportAccountToPDF, exportAccountToCSV } from "../utils/exportUtils";
import { Link } from "react-router-dom";

function formatDate(dateString: string): string {
  const d = new Date(dateString);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function LedgerPage() {
  const { entity } = useSelectedEntity();

  // pull these from the selected entity (or empty if none)
  const entityId = entity?.id ?? "";
  const entityName = useMemo(() => entity?.name ?? "", [entity?.name]);
  const entityRuc = useMemo(() => entity?.ruc ?? "", [entity?.ruc]);

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
    
  // Load journal entries for selected entity
  useEffect(() => {
    if (!entityId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    fetchJournalEntries(entityId)
      .then(setEntries)
      .catch((err) => {
        console.error("Error al cargar asientos:", err);
        setEntries([]);
      })
      .finally(() => setLoading(false));
  }, [entityId]);

  // Group and sort entries by account
  const groupedByAccount = useMemo(() => {
    if (!entries.length) return {} as Record<string, JournalEntry[]>;
    const sorted = [...entries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  
    const grouped: Record<string, JournalEntry[]> = {};
    for (const e of sorted) {
      const code = e.account_code || "SIN_CODIGO";
      if (!grouped[code]) grouped[code] = [];
      grouped[code].push(e);
      }
      return grouped;
  }, [entries]);

  // If no entity is selected yet, guide the user
  if (!entityId) {
    return (
      <div className="pt-20 p-6">
        <h2 className="text-xl font-bold text-blue-700 mb-3">📚 Libro Mayor</h2>
        <p className="mb-4">
          Primero selecciona una entidad en el{" "}
          <Link to="/dashboard" className="text-blue-600 underline">
            Tablero de Entidades
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="pt-20 p-6">
      <h2 className="text-xl font-bold text-blue-700 mb-1">📚 Libro Mayor</h2>
      <p className="text-l text-gray-600 mb-4">
        Entidad: {entityRuc} — {entityName}
      </p>

      {loading && <p className="text-blue-600 animate-pulse">⏳ Cargando asientos...</p>}

      {!loading && !entries.length && (
        <p className="text-gray-500 italic">No hay asientos para esta entidad.</p>
      )}

      {Object.entries(groupedByAccount)
      .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
      .map(([code, accountEntries]) => {
        const nombreCuenta = accountEntries[0]?.account_name || "";
        const totalDebits = accountEntries.reduce((s, e) => s + (e.debit || 0), 0);
        const totalCredits = accountEntries.reduce((s, e) => s + (e.credit || 0), 0);
        const saldoFinal = totalDebits - totalCredits;
        const exportRows = accountEntries.map(e => ({
          date: e.date,
          description: e.description ?? "",
          debit: e.debit,
          credit: e.credit,
        }));

  return (
    <div key={code} className="mb-6 border rounded p-4 bg-white shadow">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-700">
          Cuenta: {code} — {nombreCuenta}
        </h3>
              <div className="space-x-2">
                <button
                  onClick={() => exportAccountToPDF(code, nombreCuenta || "Sin nombre", accountEntries)}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  📄 PDF
                </button>
                <button
                  onClick={() => exportAccountToCSV(code, nombreCuenta || "", accountEntries)}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  📥 CSV
                </button>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">Fecha</th>
                  <th className="text-left p-2">Descripción</th>
                  <th className="text-right p-2">Débito</th>
                  <th className="text-right p-2">Crédito</th>
                </tr>
              </thead>
              <tbody>
                {accountEntries.map((e, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{formatDate(e.date)}</td>
                    <td className="p-2">{e.description}</td>
                    <td className="p-2 text-right">
                      {e.debit !== undefined
                        ? e.debit.toLocaleString("es-EC", { minimumFractionDigits: 2 })
                        : "-"}
                    </td>
                    <td className="p-2 text-right">
                      {e.credit !== undefined
                        ? e.credit.toLocaleString("es-EC", { minimumFractionDigits: 2 })
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 text-right font-semibold text-gray-700">
              <p>
                Total Débitos:{" "}
                {totalDebits.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
              </p>
              <p>
                Total Créditos:{" "}
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