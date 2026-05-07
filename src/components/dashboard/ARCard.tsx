import React from "react";
import { InboxArrowDownIcon } from "@heroicons/react/24/outline";

interface Props {
  value: number;
}

export default function ARCard({ value }: Props) {
  return (
    <div className="dashboard-card flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">CxC</p>
        <p className="mt-1 text-xl sm:text-3xl font-bold text-blue-600 tabular-nums">
          ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">Saldo pendiente de cobro</p>
      </div>
      <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg shrink-0">
        <InboxArrowDownIcon className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
      </div>
    </div>
  );
}
