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
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Ganancia</p>
        <p className={`mt-2 text-3xl font-bold ${valueColor}`}>
          ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-sm text-gray-400 mt-1">Ingresos menos gastos</p>
      </div>
      <div className={`p-2 ${bgColor} rounded-lg`}>
        <BanknotesIcon className={`w-6 h-6 ${iconColor}`} />
      </div>
    </div>
  );
}
