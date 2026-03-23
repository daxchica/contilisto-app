// src/components/BankReconciliation.tsx

import { JournalEntry } from "../types/JournalEntry";
import { BankMovement } from "@/types/bankTypes";
import { fetchBankMovements, reconcileBankMovement, unreconcileBankMovement } from "../services/bankMovementService";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
type TestFetch = typeof fetchBankMovements;

interface Props {
  journalEntries: JournalEntry[];
  bankMovements: BankMovement[];
}

export default function BankReconciliation({ journalEntries, bankMovements }: Props) {
  const { selectedEntity } = useSelectedEntity();

const handleToggleReconcile = async (movement: BankMovement & { id: string }) => {
  if (!selectedEntity?.id) return;

  try {
    if (movement.reconciled) {
      await unreconcileBankMovement(selectedEntity.id, movement.id);
    } else {
      await reconcileBankMovement(selectedEntity.id, movement.id);
    }
  } catch (err) {
    console.error("Error updating reconciliation:", err);
  }
};

  const formatAmount = (value?: number) =>
    value !== undefined
      ? new Intl.NumberFormat("es-EC", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
      }).format(value)
    : "-";

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h2 className="text-lg font-bold text-blue-700 mb-2">📒 Libro Diario</h2>
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th>Fecha</th>
              <th>Cuenta</th>
              <th>Débito</th>
              <th>Crédito</th>
            </tr>
          </thead>
          <tbody>
            {journalEntries.map((entry, i) => (
              <tr key={i} className="border-t">
                <td>{entry.date}</td>
                <td>{entry.account_code}</td>
                <td>{entry.account_name}</td>
                <td>{entry.debit || "-"}</td>
                <td>{entry.credit || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-lg font-bold text-green-700 mb-2">🏦 Banco</h2>
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Monto</th>
              <th>Conciliar</th>
            </tr>
          </thead>
          <tbody>
            {bankMovements
              .filter((mvt): mvt is BankMovement & { id: string } => !!mvt.id)
              .map((mvt) => {
                const isReconciled = !!mvt.reconciled;
                
                return (
                <tr 
                  key={mvt.id} 
                  className={`border-t ${isReconciled ? "bg-green-100" : "hover:bg-gray-50"}`}
                >
                <td>{mvt.date}</td>
                <td>{mvt.description}</td>
                <td>{formatAmount(mvt.amount)}</td>
                <td>
                  <button
                    onClick={() => handleToggleReconcile(mvt)}
                    className={`px-2 py-1 text-xs rounded ${
                      isReconciled
                        ? "bg-green-500 text-white"
                        : "bg-gray-200"
                    }`}
                  >
                    {isReconciled ? "✅ Conciliado" : "Conciliar"}
                  </button>
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>
    </div>
  );
}