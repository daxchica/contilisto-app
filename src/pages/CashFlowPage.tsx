// ============================================================================
// src/pages/CashFlowPage.tsx
// ---------------------------------------------------------------------------
// Cash Flow Page (REAL)
// Based exclusively on Bank Movements (Libro Bancos)
//
// USER-FACING (Spanish):
// - Flujo de efectivo real de la empresa
// ============================================================================

import React, { useEffect, useState } from "react";
import { fetchCashflow } from "@/services/cashflowService";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

function money(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function CashFlowPage() {
  const { selectedEntity } = useSelectedEntity();
  const entityId = selectedEntity?.id ?? "";

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!entityId) {
      setData(null);
      return;
    }

    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetchCashflow(
          entityId, 
          from || undefined, 
          to || undefined
        );
        setData(res);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando flujo de caja");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [entityId, from, to]);

  if (!entityId) {
    return (
      <div className="p-6">
        <p className="text-gray-600">
          Selecciona una empresa para ver el flujo de efectivo.
        </p>
      </div>
    );
  }

  const totals = data?.totals;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Flujo de Efectivo</h1>
        <p className="text-sm text-gray-600">
          Empresa: {selectedEntity?.name}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="text-xs">Desde</label>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs">Hasta</label>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Kpi title="Operación" value={money(totals?.operating ?? 0)} />
        <Kpi title="Inversión" value={money(totals?.investing ?? 0)} />
        <Kpi title="Financiamiento" value={money(totals?.financing ?? 0)} />
        <Kpi title="Sin clasificar" value={money(totals?.uncategorized ?? 0)} />
        <Kpi title="Neto" value={money(totals?.net ?? 0)} strong />
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b">
            <tr>
              <th className="p-3 text-left">Fecha</th>
              <th className="p-3 text-left">Descripción</th>
              <th className="p-3 text-left">Cuenta bancaria</th>
              <th className="p-3 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {data?.events?.map((e: any) => (
              <tr key={e.id} className="border-b">
                <td className="p-3">{e.date}</td>
                <td className="p-3">{e.description}</td>
                <td className="p-3">{e.bankAccountId}</td>
                <td
                  className={`p-3 text-right font-semibold ${
                    e.amount >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {money(e.amount)}
                </td>
              </tr>
            ))}

            {!loading && data?.events?.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500">
                  No hay movimientos en el período seleccionado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && <p className="text-sm text-gray-500">Cargando…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Kpi({
  title,
  value,
  strong,
}: {
  title: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="text-xs text-gray-500">{title}</div>
      <div className={`text-lg ${strong ? "font-bold" : "font-semibold"}`}>
        {value}
      </div>
    </div>
  );
}