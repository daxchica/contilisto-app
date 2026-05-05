import React from "react";
import { ArrowTrendingDownIcon } from "@heroicons/react/24/outline";

interface Props {
  value: number;
}

const ExpenseCard: React.FC<Props> = ({ value }) => {
  return (
    <div className="dashboard-card flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Gastos</p>
        <p className="mt-2 text-3xl font-bold text-red-600">
          ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-sm text-gray-400 mt-1">Total de gastos registrados</p>
      </div>
      <div className="p-2 bg-red-100 rounded-lg">
        <ArrowTrendingDownIcon className="w-6 h-6 text-red-600" />
      </div>
    </div>
  );
};

export default ExpenseCard;
