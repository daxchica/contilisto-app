// src/hooks/useInitialBalances.ts
import { useEffect, useState } from "react";
import { fetchInitialBalances } from "../services/initialBalanceService";
import { useSelectedEntity } from "../context/SelectedEntityContext";

type InitialBalance = {
  account_code: string;
  account_name: string;
  initial_balance: number;
  type?: "debit" | "credit"; // Opcional
};

export function useInitialBalances(): InitialBalance[] {
  const { selectedEntity } = useSelectedEntity();
  const [balances, setBalances] = useState<InitialBalance[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!selectedEntity?.id) return;
      const map = await fetchInitialBalances(selectedEntity.id);

      // Convertir a array para el componente
      const array: InitialBalance[] = Object.values(map).map((b) => ({
        ...b,
        type: b.initial_balance < 0 ? "credit" : "debit",
      }));

      setBalances(array);
    };

    load();
  }, [selectedEntity]);

  return balances;
}