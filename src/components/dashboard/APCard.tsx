import React from "react";
import { ArrowUpCircleIcon } from "@heroicons/react/24/outline";

interface Props {
  value: number;
}

export default function APCard({ value }: Props) {
  return (
    <div className="dashboard-card flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Cuentas por pagar</p>
        <p className="mt-2 text-3xl font-bold text-orange-600">
          ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-sm text-gray-400 mt-1">Saldo pendiente de pago</p>
      </div>
      <div className="p-2 bg-orange-100 rounded-lg">
        <ArrowUpCircleIcon className="w-6 h-6 text-orange-600" />
      </div>
    </div>
  );
}
