import React, { useEffect, useMemo, useState } from "react";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { getUnifiedCashflow } from "@/services/cashFlowUnifiedService";
import type { UnifiedCashflowEvent, UnifiedCashflowResult } from "@/types/UnifiedCashflow";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(
    Number(n || 0)
  );

function ymdToday() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysYMD(ymd: string, days: number) {
  const d = new Date(ymd);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Tab = "unified" | "real" | "forecast";

export default function CashFlowDashboard() {
  const { selectedEntity } = useSelectedEntity();

  const [from, setFrom] = useState<string>(() => ymdToday());
  const [to, setTo] = useState<string>(() => addDaysYMD(ymdToday(), 60));
  const [tab, setTab] = useState<Tab>("unified");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<UnifiedCashflowResult | null>(null);

  useEffect(() => {
    if (!selectedEntity?.id) return;

    const entityId = selectedEntity.id;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getUnifiedCashflow(entityId, from, to);
        setData(res);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando flujo de caja");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedEntity?.id, from, to]);

  const filteredEvents = useMemo(() => {
    if (!data) return [];
    if (tab === "unified") return data.events;
    if (tab === "real") return data.events.filter((e) => e.type === "opening" || e.type === "real");
    return data.events.filter((e) => e.type === "opening" || e.type === "forecast");
  }, [data, tab]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Flujo de Caja</h1>
          <p className="text-sm text-gray-500">
            Unificado (Saldo Inicial + Real + Proyección)
          </p>
        </div>

        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="text-xs text-gray-500">Desde</label>
            <input
              type="date"
              className="border rounded-lg px-3 py-2 text-sm w-[160px]"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Hasta</label>
            <input
              type="date"
              className="border rounded-lg px-3 py-2 text-sm w-[160px]"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-2">
        <button
          className={`px-4 py-2 rounded-lg text-sm border ${tab === "unified" ? "bg-black text-white" : ""}`}
          onClick={() => setTab("unified")}
        >
          Unificado
        </button>
        <button
          className={`px-4 py-2 rounded-lg text-sm border ${tab === "real" ? "bg-black text-white" : ""}`}
          onClick={() => setTab("real")}
        >
          Real (Bancos)
        </button>
        <button
          className={`px-4 py-2 rounded-lg text-sm border ${tab === "forecast" ? "bg-black text-white" : ""}`}
          onClick={() => setTab("forecast")}
        >
          Proyección (AR/AP)
        </button>
      </div>

      {/* Status */}
      {loading && <div className="mt-4 text-sm text-gray-500">Cargando…</div>}
      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      {/* Totals */}
      {data && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="border rounded-xl p-4">
            <div className="text-xs text-gray-500">Saldo Inicial</div>
            <div className="text-lg font-semibold">{fmt(data.openingBalance)}</div>
          </div>
          <div className="border rounded-xl p-4">
            <div className="text-xs text-gray-500">Ingresos</div>
            <div className="text-lg font-semibold">{fmt(data.totals.inflow)}</div>
          </div>
          <div className="border rounded-xl p-4">
            <div className="text-xs text-gray-500">Egresos</div>
            <div className="text-lg font-semibold">{fmt(data.totals.outflow)}</div>
          </div>
          <div className="border rounded-xl p-4">
            <div className="text-xs text-gray-500">Saldo Proyectado</div>
            <div className="text-lg font-semibold">{fmt(data.projectedClosingBalance)}</div>
          </div>
        </div>
      )}

      {/* Timeline table */}
      {data && (
        <div className="mt-6 border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 text-sm font-medium">
            Línea de tiempo ({filteredEvents.length})
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white sticky top-0">
                <tr className="border-b">
                  <th className="text-left p-3">Fecha</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Categoría</th>
                  <th className="text-left p-3">Descripción</th>
                  <th className="text-right p-3">Monto</th>
                  <th className="text-right p-3">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((e) => (
                  <tr key={e.id} className="border-b last:border-b-0">
                    <td className="p-3 whitespace-nowrap">{e.date}</td>
                    <td className="p-3 whitespace-nowrap">
                      {e.type === "opening" ? "Inicial" : e.type === "real" ? "Real" : "Proyección"}
                    </td>
                    <td className="p-3 whitespace-nowrap">{e.category}</td>
                    <td className="p-3 min-w-[420px]">{e.description}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {fmt(e.amount)}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {fmt(e.runningBalance ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}