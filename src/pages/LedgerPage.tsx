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
import { fetchJournalEntriesByDateRange } from "@/services/journalService";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function formatDate(dateString: string): string {
  if (!dateString) return "-";
  return dateString.slice(0, 10);
}

function normalizeAccountCode(code?: string) {
  return (code || "").replace(/\./g, "").trim();
}

function buildLedgerDescription(e: JournalEntry): string {
  const invoice = e.invoice_number?.trim();
  const supplier = (e as any).supplier_name?.trim();
  const customer = (e as any).customer_name?.trim();

  if (invoice) {
    const party = supplier || customer;
    return party
      ? `Factura ${invoice} — ${party}`
      : `Factura ${invoice}`;
  }

  return e.description?.trim() || "Asiento contable";
}

function formatMoney(n: number) {
  return n.toLocaleString("es-EC", { minimumFractionDigits: 2 });
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function LedgerPage() {
  const { selectedEntity } = useSelectedEntity();

  const entityId = selectedEntity?.id ?? "";
  const entityName = useMemo(() => selectedEntity?.name ?? "", [selectedEntity?.name]);
  const entityRuc = useMemo(() => selectedEntity?.ruc ?? "", [selectedEntity?.ruc]);

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  /* -------------------------------------------------------------------------- */
  /* FETCH                                                                      */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    if (!entityId) {
      setEntries([]);
      return;
    }

    (async () => {
      try {
        setLoading(true);

        const data = await fetchJournalEntriesByDateRange(
          entityId,
          fromDate || undefined,
          toDate || undefined
        );

        setEntries(data);
      } catch (err) {
        console.error("Error al cargar asientos:", err);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [entityId, fromDate, toDate]);

  /* -------------------------------------------------------------------------- */
  /* SEARCH FILTER                                                              */
  /* -------------------------------------------------------------------------- */

  const filteredEntries = useMemo(() => {
    if (!entries.length) return [];

    let result = [...entries];

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
  }, [entries, searchTerm]);

  /* -------------------------------------------------------------------------- */
  /* GROUP BY ACCOUNT                                                           */
  /* -------------------------------------------------------------------------- */

  const groupedByAccount = useMemo(() => {
    if (!filteredEntries.length) return {} as Record<string, JournalEntry[]>;

    const sorted = [...filteredEntries].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();

      if (da !== db) return da - db;

      return (a.createdAt || 0) - (b.createdAt || 0);
    });

    const grouped: Record<string, JournalEntry[]> = {};

    for (const e of sorted) {
      const code = normalizeAccountCode(e.account_code) || "SIN_CODIGO";

      if (!grouped[code]) grouped[code] = [];
      grouped[code].push(e);
    }

    return grouped;
  }, [filteredEntries]);

  /* -------------------------------------------------------------------------- */
  /* UI HELPERS                                                                 */
  /* -------------------------------------------------------------------------- */

  const handleClearFilters = () => {
    setFromDate("");
    setToDate("");
    setSearchTerm("");
  };

  const canExportAll = Object.keys(groupedByAccount).length > 0;

  /* -------------------------------------------------------------------------- */
  /* EMPTY ENTITY                                                               */
  /* -------------------------------------------------------------------------- */

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

  /* -------------------------------------------------------------------------- */
  /* RENDER                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="pt-8">
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-6">

        {/* HEADER */}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
          <div>
            <h2 className="text-xl font-bold text-blue-700 mb-1 flex items-center gap-2">
              📚 Libro Mayor
            </h2>

            <p className="text-sm text-gray-600">
              Empresa: <span className="font-semibold">{entityName}</span>{" "}
              — RUC: <span className="font-mono">{entityRuc}</span>
            </p>
          </div>
        </div>

        {/* FILTERS */}

        <div className="mt-4 mb-6 bg-white shadow-sm border border-gray-200 rounded-xl p-4">

          <div className="grid grid-cols-12 gap-3 items-end">

            <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex flex-col">
              <label className="text-xs font-semibold text-gray-500 mb-1 uppercase">
                Desde
              </label>

              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex flex-col">
              <label className="text-xs font-semibold text-gray-500 mb-1 uppercase">
                Hasta
              </label>

              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div className="col-span-12 lg:col-span-5 flex flex-col">
              <label className="text-xs font-semibold text-gray-500 mb-1 uppercase">
                Buscar
              </label>

              <input
                type="text"
                placeholder="Descripción, cuenta, código o factura…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div className="col-span-12 lg:col-span-3 flex gap-2 justify-end">
              <button
                onClick={handleClearFilters}
                className="px-3 py-2 text-sm border rounded-md"
              >
                Limpiar
              </button>

              <button
                onClick={() =>
                  exportFullLedgerToPDF(entityName, entityRuc, groupedByAccount)
                }
                disabled={!canExportAll}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md"
              >
                📄 Exportar PDF
              </button>
            </div>

          </div>
        </div>

        {loading && <p className="text-blue-600 animate-pulse">⏳ Cargando...</p>}

        {!loading && !entries.length && (
          <p className="text-gray-500 italic">
            No hay asientos para esta entidad.
          </p>
        )}

        {Object.entries(groupedByAccount)
          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
          .map(([code, accountEntries]) => {

            const nombreCuenta = accountEntries[0]?.account_name || "";

            const totalDebits = accountEntries.reduce(
              (s, e) => s + Number(e.debit || 0),
              0
            );

            const totalCredits = accountEntries.reduce(
              (s, e) => s + Number(e.credit || 0),
              0
            );

            const saldoFinal = totalDebits - totalCredits;

            const exportRows = accountEntries.map((e) => ({
              date: e.date,
              description: buildLedgerDescription(e),
              debit: e.debit,
              credit: e.credit,
            }));

            return (
              <div key={code} className="mb-6 border rounded-xl p-4 bg-white shadow-sm">

                <div className="flex justify-between mb-3">

                  <h3 className="text-lg font-semibold text-gray-700">
                    Cuenta: {code} — {nombreCuenta}
                  </h3>

                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        exportAccountToPDF(code, nombreCuenta, accountEntries)
                      }
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md"
                    >
                      📄 PDF
                    </button>

                    <button
                      onClick={() =>
                        exportAccountToCSV(code, nombreCuenta, exportRows)
                      }
                      className="px-3 py-2 text-sm bg-green-600 text-white rounded-md"
                    >
                      📥 CSV
                    </button>
                  </div>

                </div>

                <div className="overflow-x-auto">

                  <table className="min-w-[720px] w-full text-sm">

                    <thead className="bg-gray-100">

                      <tr>
                        <th className="text-left p-2">Fecha</th>
                        <th className="text-left p-2">Documento</th>
                        <th className="text-left p-2">Descripción</th>
                        <th className="text-right p-2">Débito</th>
                        <th className="text-right p-2">Crédito</th>
                        <th className="text-right p-2">Saldo</th>
                      </tr>

                    </thead>

                    <tbody>

                      {(() => {
                        let runningBalance = 0;

                        return accountEntries.map((e, i) => {

                          const debit = Number(e.debit || 0);
                          const credit = Number(e.credit || 0);

                          runningBalance += debit - credit;

                          return (
                            <tr key={i} className="border-t">

                              <td className="p-2 whitespace-nowrap">
                                {formatDate(e.date)}
                              </td>

                              <td className="p-2 whitespace-nowrap">
                                {
                                  e.invoice_number 
                                    ? e.invoice_number
                                    : e.source === "manual"
                                      ? "MANUAL"
                                      : e.documentId || "-"
                                }
                              </td>

                              <td className="p-2">
                                {buildLedgerDescription(e)}
                              </td>

                              <td className="p-2 text-right">
                                {debit ? formatMoney(debit) : "-"}
                              </td>

                              <td className="p-2 text-right">
                                {credit ? formatMoney(credit) : "-"}
                              </td>

                              <td
                                className={`p-2 text-right font-semibold ${
                                  runningBalance < 0
                                    ? "text-red-600"
                                    : "text-gray-900"
                                }`}
                              >
                                {formatMoney(runningBalance)}
                              </td>

                            </tr>
                          );
                        });
                      })()}

                    </tbody>
                  </table>

                </div>

                <div className="mt-4 text-right font-semibold text-sm">

                  <p>Total Débitos: {formatMoney(totalDebits)}</p>

                  <p>Total Créditos: {formatMoney(totalCredits)}</p>

                  <p
                    className={
                      saldoFinal >= 0 ? "text-green-600" : "text-red-600"
                    }
                  >
                    Saldo Final: {formatMoney(saldoFinal)}
                  </p>

                </div>

              </div>
            );
          })}
      </div>
    </div>
  );
}