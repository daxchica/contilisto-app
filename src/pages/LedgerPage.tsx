// src/pages/LedgerPage.tsx

import React, { useEffect, useState, useMemo } from "react";
import { useSelectedEntity } from "../context/SelectedEntityContext";
import type { JournalEntry } from "../types/JournalEntry";
import {
  exportAccountToPDF,
  exportAccountToCSV,
  exportFullLedgerToPDF,
} from "../utils/exportUtils";
import { Link } from "react-router-dom";
import { fetchJournalEntries } from "@/services/journalService";

function formatDate(dateString: string): string {
  const d = new Date(dateString);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function LedgerPage() {
  const { selectedEntity } = useSelectedEntity();

  const entityId = selectedEntity?.id ?? "";
  const entityName = useMemo(() => selectedEntity?.name ?? "", [selectedEntity?.name]);
  const entityRuc = useMemo(() => selectedEntity?.ruc ?? "", [selectedEntity?.ruc]);

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    if (!entityId) {
      setEntries([]);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const data = await fetchJournalEntries(entityId);
        setEntries(data);
      } catch (err) {
        console.error("Error al cargar asientos:", err);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [entityId]);

  const filteredEntries = useMemo(() => {
    if (!entries.length) return [];

    let result = [...entries];

    if (fromDate) {
      const fromTs = new Date(fromDate).getTime();
      result = result.filter((e) => {
        const ts = new Date(e.date).getTime();
        return !isNaN(ts) && ts >= fromTs;
      });
    }

    if (toDate) {
      const toTs = new Date(toDate).getTime();
      result = result.filter((e) => {
        const ts = new Date(e.date).getTime();
        return !isNaN(ts) && ts <= toTs;
      });
    }

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter((e) => {
        const desc = (e.description || "").toLowerCase();
        const name = (e.account_name || "").toLowerCase();
        const code = (e.account_code || "").toLowerCase();
        const invoice = (e.invoice_number || "").toLowerCase();
        return (
          desc.includes(term) ||
          name.includes(term) ||
          code.includes(term) ||
          invoice.includes(term)
        );
      });
    }

    return result;
  }, [entries, fromDate, toDate, searchTerm]);

  const groupedByAccount = useMemo(() => {
    if (!filteredEntries.length) return {} as Record<string, JournalEntry[]>;

    const sorted = [...filteredEntries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const grouped: Record<string, JournalEntry[]> = {};
    for (const e of sorted) {
      const code = e.account_code || "SIN_CODIGO";
      if (!grouped[code]) grouped[code] = [];
      grouped[code].push(e);
    }
    return grouped;
  }, [filteredEntries]);

  const handleClearFilters = () => {
    setFromDate("");
    setToDate("");
    setSearchTerm("");
  };

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

  const canExportAll = Object.keys(groupedByAccount).length > 0;

  return (
    <div className="pt-8">
      {/* Más ancho en desktop, sin verse “vacío” */}
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
          <div>
            <h2 className="text-xl font-bold text-blue-700 mb-1 flex items-center gap-2">
              <span>📚 Libro Mayor</span>
            </h2>
            <p className="text-sm text-gray-600">
              Empresa: <span className="font-semibold">{entityName}</span>{" "}
              — RUC: <span className="font-mono">{entityRuc}</span>
            </p>
          </div>
        </div>

        {/* Filtros (12-column grid = cero “espacios raros” en desktop) */}
        <div className="mt-4 mb-6 bg-white shadow-sm border border-gray-200 rounded-xl p-4">
          <div className="grid grid-cols-12 gap-3 items-end">
            {/* Desde */}
            <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex flex-col">
              <label className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                Desde
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Hasta */}
            <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex flex-col">
              <label className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                Hasta
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Buscar */}
            <div className="col-span-12 lg:col-span-5 flex flex-col">
              <label className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                Buscar{" "}
                <span className="text-[11px] text-gray-400 font-semibold normal-case">
                  (descripción, cuenta, código o factura)
                </span>
              </label>
              <input
                type="text"
                placeholder="Escribe para filtrar movimientos…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Acciones */}
            <div className="col-span-12 lg:col-span-3 flex flex-col sm:flex-row gap-2 lg:justify-end">
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
              >
                Limpiar filtros
              </button>

              <button
                type="button"
                onClick={() => exportFullLedgerToPDF(entityName, entityRuc, groupedByAccount)}
                disabled={!canExportAll}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                📄 Exportar todo a PDF
              </button>
            </div>
          </div>
        </div>

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

            const exportRows = accountEntries.map((e) => ({
              date: e.date,
              description: e.description ?? "",
              debit: e.debit,
              credit: e.credit,
            }));

            return (
              <div key={code} className="mb-6 border rounded-xl p-4 bg-white shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-700">
                    Cuenta: {code} — {nombreCuenta}
                  </h3>

                  <div className="flex gap-2 flex-wrap sm:justify-end">
                    <button
                      onClick={() => exportAccountToPDF(code, nombreCuenta || "Sin nombre", accountEntries)}
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      📄 PDF
                    </button>
                    <button
                      onClick={() => exportAccountToCSV(code, nombreCuenta || "", exportRows)}
                      className="px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      📥 CSV
                    </button>
                  </div>
                </div>

                {/* Tabla responsive */}
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full text-sm">
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
                          <td className="p-2 whitespace-nowrap">{formatDate(e.date)}</td>
                          <td className="p-2">{e.description}</td>
                          <td className="p-2 text-right whitespace-nowrap">
                            {e.debit !== undefined
                              ? e.debit.toLocaleString("es-EC", { minimumFractionDigits: 2 })
                              : "-"}
                          </td>
                          <td className="p-2 text-right whitespace-nowrap">
                            {e.credit !== undefined
                              ? e.credit.toLocaleString("es-EC", { minimumFractionDigits: 2 })
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 text-right font-semibold text-gray-700 text-sm">
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
    </div>
  );
}