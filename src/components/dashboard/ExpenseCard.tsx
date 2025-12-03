// src/components/dashboard/ExpenseCard.tsx
import React from "react";

interface Props {
  value: number;   // total de gastos calculado en DashboardHome
}

const ExpenseCard: React.FC<Props> = ({ value }) => {
  return (
    <div className="dashboard-card">
      <h3 className="dashboard-title">Gastos</h3>

      <p className="text-3xl font-bold text-red-600">
        ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </p>

      <p className="text-sm text-gray-500 mt-2">
        Total de gastos registrados</p>
    </div>
  );
};

export default ExpenseCard;