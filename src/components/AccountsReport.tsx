// src/components/AccountsReport.tsx
import { getAccountsReceivable, getAccountsPayable } from "../utils/reporting";

export default function AccountsReport({ journal }) {
  const ar = getAccountsReceivable(journal);
  const ap = getAccountsPayable(journal);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <div>
        <h2 className="text-lg font-bold mb-2">📥 Cuentas por Cobrar</h2>
        <ul className="border rounded p-3 bg-white shadow">
          {Object.entries(ar).map(([name, value]) => (
            <li key={name} className="flex justify-between py-1 border-b last:border-none">
              <span>{name}</span>
              <span>${value.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-lg font-bold mb-2">📤 Cuentas por Pagar</h2>
        <ul className="border rounded p-3 bg-white shadow">
          {Object.entries(ap).map(([name, value]) => (
            <li key={name} className="flex justify-between py-1 border-b last:border-none">
              <span>{name}</span>
              <span>${value.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}