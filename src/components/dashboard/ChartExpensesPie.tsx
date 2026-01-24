// src/components/dashboard/ChartExpensesPie.tsx
import React, { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

import type { JournalEntry } from "@/types/JournalEntry";

interface ChartExpensesPieProps {
  entries: JournalEntry[];
}

/* ============================================================================
 * SAFETY HELPER (LOGIC ONLY — NO UI IMPACT)
 * ========================================================================== */
function startsWithSafe(value: unknown, prefix: string): boolean {
  return typeof value === "string" && value.startsWith(prefix);
}

export default function ChartExpensesPie({ entries }: ChartExpensesPieProps) {
  // ========================
  // 1. Filtrar solo cuentas de gastos (SAFE)
  // ========================
  
  const expenses = useMemo(() => { 
    return entries.filter(
      (e) =>
        startsWithSafe(e.account_code, "5") ||
        startsWithSafe(e.account_code, "6")
    );
  }, [entries]);

  // =======================
  // 2. Agrupar por cuenta contable
  // =======================
  const grouped = useMemo(() => {
    const map: Record<string, number> = {};

    expenses.forEach((e) => {
      const key = `${e.account_code ?? "SIN-CUENTA"} - ${e.account_name ?? "Sin nombre"}`;
      const value = e.debit || 0;
      map[key] = (map[key] || 0) + value;
    });

    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
    }));
  }, [expenses]);

  // =========================
  // 3. Colores corporativos (UNCHANGED)
  // =========================
  const COLORS = [
    "#0A3558",
    "#16a34a",
    "#dc2626",
    "#0284c7",
    "#9333ea",
    "#f59e0b",
    "#14b8a6",
    "#ef4444"
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow h-[500px]">
      <h3 className="text-gray-700 font-semibold mb-4">
        Distribución de gastos
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={grouped}
            dataKey="value"
            nameKey="name"
            cx="35%"
            cy="50%"
            outerRadius={130}
            innerRadius={70}
            paddingAngle={2}
          >
            {grouped.map((_, index) => (
              <Cell
                key={`cell=${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>

          {/* Tooltip elegante */}
          <Tooltip
            formatter={(value) => {
              const num = typeof value === "number" ? value: Number(value);
              return isNaN(num) ? "$0.00" : `$${num.toFixed(2)}`;
            }}
            contentStyle={{
              backgroundColor: "white",
              borderRadius: "10px",
              border: "1px solid #ddd",
              fontSize: "12px",
            }}  
          />

          <Legend 
            layout="vertical" 
            verticalAlign="middle"
            align="right"
            wrapperStyle={{
              fontSize: "12px",
              width: "150px",
              paddingLeft: "10px"
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}