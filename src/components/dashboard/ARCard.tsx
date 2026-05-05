import React from "react";
import { InboxArrowDownIcon } from "@heroicons/react/24/outline";

interface Props {
  value: number;
}

export default function ARCard({ value }: Props) {
  return (
    <div className="dashboard-card flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Cuentas por cobrar</p>
        <p className="mt-2 text-3xl font-bold text-blue-600">
          ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-sm text-gray-400 mt-1">Saldo pendiente de cobro</p>
      </div>
      <div className="p-2 bg-blue-100 rounded-lg">
        <InboxArrowDownIcon className="w-6 h-6 text-blue-600" />
      </div>
    </div>
  );
}
