// ============================================================================
// src/components/dashboard/CashFlowChart.tsx
// CONTILISTO — Dashboard Cash Flow Chart (REAL vs PROJECTED)
// Daily series, last N days
// ============================================================================

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

import type { CashFlowDay } from "@/utils/buildDailyCashFlowSeries";

type Props = {
  data: CashFlowDay[];
  loading?: boolean;
  title?: string;
};

function money(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function shortDayLabel(iso: string): string {
  // iso: YYYY-MM-DD
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${m}/${d}`;
}

export default function CashFlowChart({
  data,
  loading,
  title = "Flujo de Caja — Real vs Proyectado (últimos 30 días)",
}: Props) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{title}</h3>
        {loading && (
          <span className="text-xs text-gray-500">Cargando…</span>
        )}
      </div>

      {!loading && (!data || data.length === 0) ? (
        <div className="p-4 bg-gray-50 text-gray-500 text-center rounded">
          No hay datos de flujo de caja para mostrar.
        </div>
      ) : (
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                dataKey="date"
                tickFormatter={shortDayLabel}
                minTickGap={16}
              />

              <YAxis 
                tickFormatter={(v) => 
                    typeof v === "number"
                        ? v.toLocaleString("en-US", {
                            maximumFractionDigits: 0,
                           })
                        : v
                    } 
                />

              <Tooltip
                formatter={(value) => {
                  const v = Number(value ?? 0);
                  return [money(v), "Monto"];
                }}
                labelFormatter={(label) =>
                    typeof label === "string"
                        ? `Fecha: ${label}`
                        : "Fecha"
                    }
                />

              <Legend />

              {/* REAL (solid) */}
              <Line
                type="monotone"
                dataKey="realIn"
                name="Ingreso (Real)"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="realOut"
                name="Egreso (Real)"
                stroke="#dc2626"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="realNet"
                name="Neto (Real)"
                stroke="#2563eb"
                strokeWidth={3}
                dot={false}
              />

              {/* PROJECTED (dashed) */}
              <Line
                type="monotone"
                dataKey="projectedIn"
                name="Ingreso (Proyectado)"
                stroke="#16a34a"
                strokeDasharray="6 4"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="projectedOut"
                name="Egreso (Proyectado)"
                stroke="#dc2626"
                strokeDasharray="6 4"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="projectedNet"
                name="Neto (Proyectado)"
                stroke="#2563eb"
                strokeDasharray="6 4"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}