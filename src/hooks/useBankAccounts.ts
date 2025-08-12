// src/hooks/useBankAccounts.ts

import { useEffect, useState } from "react";
import {
  fetchBankAccounts,
  createBankAccount,
  deleteBankAccount,
} from "../services/bankAccountService";
import { BankAccount } from "../types/BankTypes";

export function useBankAccounts(entityId: string, userId: string) {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!entityId) return;

    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchBankAccounts(entityId);
        setBankAccounts(data);
      } catch (err: any) {
        setError("Error al cargar cuentas bancarias");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [entityId]);

  const addBank = async (name: string) => {
    try {
      await createBankAccount(entityId, name, userId);
      const updated = await fetchBankAccounts(entityId);
      setBankAccounts(updated);
    } catch (err: any) {
      setError("Error al crear cuenta bancaria");
      console.error(err);
    }
  };

  const removeBank = async (bankId: string) => {
    try {
      await deleteBankAccount(entityId, bankId);
      setBankAccounts((prev) => prev.filter((b) => b.id !== bankId));
    } catch (err: any) {
      setError("Error al eliminar cuenta bancaria");
      console.error(err);
    }
  };

  return {
    bankAccounts,
    loading,
    error,
    addBank,
    removeBank,
  };
}