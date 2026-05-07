import React from "react";
import { ArrowTrendingDownIcon } from "@heroicons/react/24/outline";

interface Props {
  value: number;
}

const ExpenseCard: React.FC<Props> = ({ value }) => {
  return (
    <div className="dashboard-card flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gastos</p>
        <p className="mt-1 text-xl sm:text-3xl font-bold text-red-600 tabular-nums">
          ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">Total de gastos registrados</p>
      </div>
      <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg shrink-0">
        <ArrowTrendingDownIcon className="w-4 h-4 sm:w-6 sm:h-6 text-red-600" />
      </div>
    </div>
  );
};

export default ExpenseCard;
