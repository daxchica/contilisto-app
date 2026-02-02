// src/components/AccountsReport.tsx

import type { JournalEntry } from "@/types/JournalEntry";
import { getAccountsReceivable, getAccountsPayable } from "../utils/reporting";

interface Props {
  journal: JournalEntry[];
}

export default function AccountsReport({ journal }: Props) {
  const ar = getAccountsReceivable(journal);
  const ap = getAccountsPayable(journal);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <div>
        <h2 className="text-lg font-bold mb-2">📥 Cuentas por Cobrar</h2>
        <ul className="border rounded p-3 bg-white shadow">
          {Object.entries(ar).map(([key, v]) => (
            <li key={key} className="flex justify-between py-1 border-b last:border-none">
              <span>{v.customerName}
                <div className="text-sx text-gray-400">{v.customerRUC}</div>
              </span>
              <span>${v.balance.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-lg font-bold mb-2">📤 Cuentas por Pagar</h2>
        <ul className="border rounded p-3 bg-white shadow">
          {Object.entries(ap).map(([key, v]) => (
            <li key={key} className="flex justify-between py-1 border-b last:border-none">
              <span>{v.supplierName}
                <div className="text-xs text-gray-400">{v.supplierRUC}</div>
              </span>
              <span>${v.balance.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}