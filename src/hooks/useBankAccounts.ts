// src/hooks/useBankAccounts.ts

import { useEffect, useState } from "react";
import {
  fetchBankAccounts,
  createBankAccount,
  deleteBankAccount,
} from "../services/bankAccountService";

import type { BankAccount } from "../types/bankTypes";

export function useBankAccounts(entityId: string, userIdSafe: string) {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ===================== LOAD ACCOUNTS ===================== */
  useEffect(() => {
    if (!entityId || !userIdSafe) return;

    const load = async () => {
      setLoading(true);
      try {
        // ✔ Firma correcta: (userIdSafe, entityId)
        const data = await fetchBankAccounts(userIdSafe, entityId);
        setBankAccounts(data ?? []);
      } catch (err) {
        console.error("❌ Error al cargar cuentas bancarias:", err);
        setError("Error al cargar cuentas bancarias");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [entityId, userIdSafe]);

  /* ===================== CREATE ACCOUNT ===================== */
  const addBank = async (name: string) => {
    if (!entityId || !userIdSafe) return;

    try {
      // ✔ Firma correcta: un solo objeto
      await createBankAccount({
        entityId,
        name,
        userIdSafe,
      });

      const updated = await fetchBankAccounts(userIdSafe, entityId);
      setBankAccounts(updated ?? []);
    } catch (err) {
      console.error("❌ Error al crear cuenta bancaria:", err);
      setError("Error al crear cuenta bancaria");
    }
  };

  /* ===================== DELETE ACCOUNT ===================== */
  const removeBank = async (bankId: string) => {
    if (!entityId) return;

    try {
      await deleteBankAccount(entityId, bankId);
      setBankAccounts((prev) => prev.filter((b) => b.id !== bankId));
    } catch (err) {
      console.error("❌ Error al eliminar cuenta bancaria:", err);
      setError("Error al eliminar cuenta bancaria");
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