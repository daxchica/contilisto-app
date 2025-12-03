// src/components/dashboard/ChartIncomeVsExpenses.tsx
import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ChartIncomeVsExpensesProps {
  income: Record<string, number>;
  expenses: Record<string, number>;
}

export default function ChartIncomeVsExpenses({
  income,
  expenses,
}: ChartIncomeVsExpensesProps) {
  // ==================
  // COMBINE & SORT DATA BY DATE
  // ==================
  const data = useMemo(() => {
    return Object.keys({ ...income, ...expenses })
    .sort()
    .map((month) => ({
      month,
      income: income[month] || 0,
      expenses: expenses[month] || 0,
    }));
  }, [income, expenses]);

  // =======================
  // 2. CALCULAR ESCALA AUTOMATICA
  // =======================
  const [minY, maxY] = useMemo(() => {
    const values = data.flatMap((d) => [d.income, d.expenses]);

    const min = Math.min(...values);
    const max = Math.max(...values);

    // padding automatico (10% de margen)
    const padding = (max - min) * 0.1 || 50;

    return [min - padding, max + padding];
  }, [data]);

  return (
    <div className="bg-white p-6 rounded-xl shadow h-[500px] overflow-hidden">
      <h3 className="font-semibold text-gray-700 mb-4">
        Ingresos vs Gastos
      </h3>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={data}
          margin={{ top: 10, right: 30, left: 10, bottom: 60 }}  
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          <XAxis 
            dataKey="month" 
            stroke="#6b7280"
            tickMargin={10}
            interval="preserveStartEnd"
            tick={({ x, y, payload }) => (
              <g transform={`translate(${x},${y})`}>
                <text
                  x={0}
                  y={0}
                  dy={16}
                  textAnchor="end"
                  transform="rotate(-45)"
                  fontSize={12}
                  fill="#6b7280"
              >
                {payload.value}
              </text>
              </g>
            )}
          />

          <YAxis
            domain={[minY, maxY]} 
            stroke="#6b7280"
            tick={{ fontSize: 12 }} 
          />

          {/* Tooltip elegante */}
          <Tooltip
            formatter={(value) => {
              const num = Number(value);
              return `$${num.toFixed(2)}`;
            }}
            contentStyle={{
              backgroundColor: "white",
              borderRadius: "10px",
              border: "1px solid #ddd",
              fontSize: "12px",
            }}
          />

          <Legend verticalAlign="top" height={30} />

          {/* Linea de ingresos */}
          <Line
            type="monotone"
            dataKey="income"
            name="Ingresos"
            stroke="#16a34a" // verde corporativo
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />

          {/* Linea de gastos */}
          <Line
            type="monotone"
            dataKey="expenses"
            name="Gastos"
            stroke="#dc2626" // rojo corporativo
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* 👇 DEBUG */}
      {/* <pre className="text-sm text-gray-700">
        {JSON.stringify({ income, expenses }, null, 2)}
      </pre> */}
    </div>
  );
}