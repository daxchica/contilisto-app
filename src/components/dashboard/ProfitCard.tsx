import React from "react";
import { BanknotesIcon } from "@heroicons/react/24/outline";

interface Props {
  value: number;
}

export default function ProfitCard({ value }: Props) {
  const isPositive = value >= 0;
  const valueColor = isPositive ? "text-green-600" : "text-red-600";
  const bgColor = isPositive ? "bg-green-100" : "bg-red-100";
  const iconColor = isPositive ? "text-green-600" : "text-red-600";

  return (
    <div className="dashboard-card flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ganancia</p>
        <p className={`mt-1 text-xl sm:text-3xl font-bold tabular-nums ${valueColor}`}>
          ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">Ingresos menos gastos</p>
      </div>
      <div className={`p-1.5 sm:p-2 ${bgColor} rounded-lg shrink-0`}>
        <BanknotesIcon className={`w-4 h-4 sm:w-6 sm:h-6 ${iconColor}`} />
      </div>
    </div>
  );
}
