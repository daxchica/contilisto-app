// ============================================================================
// components/InitialBalancePanel.tsx
// CONTILISTO — ACCOUNTING-SAFE INITIAL BALANCE PANEL (FINAL)
// ============================================================================

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import ManualBalanceForm, { Entry as ManualBalanceEntry } from "../ManualBalanceForm";
import BalancePDFUploader from "../BalancePDFUploader";
import BalanceSheet from "../BalanceSheet";

import type { JournalEntry, EntrySource } from "../../types/JournalEntry";
import type { Account } from "../../types/AccountTypes";
import { deleteJournalEntriesByTransactionId } from "@/services/journalService";

import {
  saveJournalEntries,
  fetchJournalEntries,
} from "@/services/journalService";
import { getDefaultInitialBalanceDate } from "@/utils/dateUtils";
import { BalanceEntry } from "@/types/BalanceTypes";


/* ========================================================================== */
/* CONFIG                                                                     */
/* ========================================================================== */

interface Props {
  entityId: string;
  userIdSafe: string;
  accounts: Account[];
  disabled?: boolean;
  initialEntries?: JournalEntry[];
  editMode?: boolean;
}

const INITIAL_BALANCE_TX = (entityId: string) =>
  `INITIAL_BALANCE:${entityId}`;

const INITIAL_SOURCE: EntrySource = "initial";

/* ========================================================================== */
/* ACCOUNTING HELPERS (CRITICAL FIX)                                          */
/* ========================================================================== */

function accountGroup(code: string): "1" | "2" | "3" | "other" {
  const g = (code ?? "").trim().charAt(0);
  if (g === "1" || g === "2" || g === "3") return g;
  return "other";
}

/**
 * For Initial Balance:
 * - Assets (1) → Debit
 * - Liabilities (2) → Credit
 * - Equity (3) → Credit
 */
function normalizeInitialSide(
  account_code: string,
  debitRaw: number,
  creditRaw: number
) {
  const debit = Number(debitRaw ?? 0);
  const credit = Number(creditRaw ?? 0);

  if (debit < 0 || credit < 0) {
    throw new Error("No se permiten valores negativos.");
  }

  if (debit > 0 && credit > 0) {
    throw new Error(
      `La cuenta ${account_code} no puede tener débito y crédito a la vez en Balance Inicial.`
    );
  }

  const amount = debit > 0 ? debit : credit;
  if (amount <= 0) return { debit: 0, credit: 0 };

  const g = accountGroup(account_code);

  if (g === "1") return { debit: amount, credit: 0 };
  if (g === "2" || g === "3") return { debit: 0, credit: amount };

  return { debit, credit };
}

/* ========================================================================== */
/* COMPONENT                                                                  */
/* ========================================================================== */

export default function InitialBalancePanel({
  entityId,
  userIdSafe,
  accounts,
  editMode = false,
}: Props) {
  const [showPanel, setShowPanel] = useState(false);
  const [balanceEntries, setBalanceEntries] = useState<JournalEntry[]>([]);
  const [showSavedMessage, setShowSavedMessage] = useState(false);
  const [existingInitialBalanceTx, setExistingInitialBalanceTx] =
    useState<boolean>(false);

  const [initialBalanceDate, setInitialBalanceDate] = useState<string>(
    getDefaultInitialBalanceDate()
  );
  const { user } = useAuth();

  /* ------------------------------------------------------------------------ */
  /* Detect if Initial Balance exists                                         */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const all = await fetchJournalEntries(entityId);
        const txId = INITIAL_BALANCE_TX(entityId);

        const exists = all.some(
          (e) =>
            e.source === "initial" &&
            e.transactionId === txId
        );

        if (!cancelled) {
          setExistingInitialBalanceTx(exists);
        }
      } catch (err) {
        console.error("Error loading journal:", err);
        if (!cancelled) setExistingInitialBalanceTx(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entityId]);

  useEffect(() => {
    if (!editMode) return;

    (async () => {
      const all = await fetchJournalEntries(entityId);
      const txId = INITIAL_BALANCE_TX(entityId);

      const initial = all.filter(
        (e) =>
          e.source === "initial" &&
          e.transactionId === txId
      );

      setBalanceEntries(initial);
      setShowPanel(true); // 👈 force open when editing
    })();
  }, [editMode, entityId]);

  /* ------------------------------------------------------------------------ */
  /* VALIDATION                                                               */
  /* ------------------------------------------------------------------------ */

  const validateInitialBalance = (entries: JournalEntry[]) => {
    if (!entries.length) {
      throw new Error("Debe ingresar al menos una línea contable.");
    }

    let debit = 0;
    let credit = 0;

    for (const e of entries) {
      if (!e.account_code) {
        throw new Error("Existen líneas sin cuenta contable.");
      }

      const g = accountGroup(e.account_code);

      if ((g === "2" || g === "3") && (e.debit ?? 0) > 0) {
        throw new Error(
          `La cuenta ${e.account_code} debe registrarse al CRÉDITO en Balance Inicial.`
        );
      }

      if (g === "1" && (e.credit ?? 0) > 0) {
        throw new Error(
          `La cuenta ${e.account_code} debe registrarse al DÉBITO en Balance Inicial.`
        );
      }

      debit += Number(e.debit ?? 0);
      credit += Number(e.credit ?? 0);
    }

    if (Math.abs(debit - credit) >= 0.01) {
      throw new Error("El Balance Inicial no está balanceado.");
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Persist Initial Balance                                                  */
  /* ------------------------------------------------------------------------ */

  const persistInitialBalance = async (entries: JournalEntry[]) => {

    const all = await fetchJournalEntries(entityId);
    const txId = INITIAL_BALANCE_TX(entityId);
    
    const exists = all.some(
      (e) => e.source === "initial" && e.transactionId === txId
  );
 
  if (exists && !editMode) {
    throw new Error("Esta entidad ya tiene un Balance Inicial guardado.");
  }

  // 🔥 DELETE OLD IF EDITING
  if (exists && editMode) {
    if (!user?.uid) {
      throw new Error("Usuario no autenticado");
    }

    await deleteJournalEntriesByTransactionId(
      entityId,
      txId,
      user.uid
    );
  }

  const payload: JournalEntry[] = entries.map((e) => ({
    ...e,
    entityId,
    uid: userIdSafe,
    transactionId: txId,
    invoice_number: "INITIAL_BALANCE",
    source: INITIAL_SOURCE,
    date: initialBalanceDate,
  }));
    
  await saveJournalEntries(entityId, userIdSafe, payload);

  setExistingInitialBalanceTx(true);
};

  /* ------------------------------------------------------------------------ */
  /* Manual Submit                                                            */
  /* ------------------------------------------------------------------------ */

  const handleManualSubmit = async (entries: ManualBalanceEntry[]) => {
    try {
      const normalized: JournalEntry[] = entries.map((e) => {
        
        const code = (e.account_code ?? "").trim();

        if (!code) {
          throw new Error("Cuenta contable inválida.");
        }

        const side = normalizeInitialSide(
          code,
          Number(e.debit ?? 0),
          Number(e.credit ?? 0)
        );

        return {
          // id: crypto.randomUUID(),
          entityId,
          uid: userIdSafe,
          account_code: code,
          account_name: (e.account_name ?? "").trim(),
          debit: side.debit,
          credit: side.credit,
          description: "Balance Inicial",
          date: initialBalanceDate,
          source: INITIAL_SOURCE,
        };
      });



      validateInitialBalance(normalized);

      const enriched = normalized.map((e) => ({
          ...e,
          entityId,
          uid: userIdSafe,
      }));

      setBalanceEntries(enriched);

      await persistInitialBalance(enriched);

      setShowSavedMessage(true);
      setTimeout(() => setShowSavedMessage(false), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* PDF Upload                                                               */
  /* ------------------------------------------------------------------------ */

  const handleUpload = async (entries: BalanceEntry[]) => {
    try {
      const normalized: JournalEntry[] = entries.map((e) => {
        const code = (e.account_code ?? "").trim();
        
        if (!code) {
          throw new Error("Cuenta contable invalida.");
        }

        const amount = Math.abs(Number(e.initial_balance ?? 0));
        const g = accountGroup(code);

        const debit = g === "1" ? amount : 0;
        const credit = g === "2" || g === "3" ? amount : 0;

        return {
          // id: crypto.randomUUID(),
          entityId,
          uid: userIdSafe,
          account_code: code,
          account_name: (e.account_name ?? "").trim(),
          debit,
          credit,
          description: "Balance Inicial",
          date: initialBalanceDate,
          source: INITIAL_SOURCE,
        };
      });

      validateInitialBalance(normalized);

      setBalanceEntries(normalized);

      await persistInitialBalance(normalized);

      setShowSavedMessage(true);
      setTimeout(() => setShowSavedMessage(false), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* RENDER                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="mt-8 border rounded shadow p-4 bg-white">
      <div className="flex justify-between items-center">
        {!editMode && (
          <button
            onClick={() => setShowPanel((p) => !p)}
            className="px-4 py-2 bg-blue-700 text-white rounded"
          >
          🧾 {showPanel ? "Ocultar" : "Carga el Balance Inicial"}
        </button>
        )}

        {showSavedMessage && (
          <span className="text-green-600 font-semibold">
            ✅ Balance inicial guardado
          </span>
        )}
      </div>

      {showPanel && (
        <div className="mt-4 space-y-6">

          {!existingInitialBalanceTx && !editMode && (
            <>
              <ManualBalanceForm
                entityId={entityId}
                accounts={accounts}
                onSubmit={handleManualSubmit}
                initialBalanceDate={initialBalanceDate}
                setInitialBalanceDate={setInitialBalanceDate}
                existingInitialBalanceTx={existingInitialBalanceTx}
              />

              <BalancePDFUploader onUploadComplete={handleUpload} />
            </>
          )}

          {/* ========================= */}
          {/* EDIT MODE (🔥 KEY FIX)    */}
          {/* ========================= */}
          {editMode && (
            <>
              <ManualBalanceForm
                entityId={entityId}
                accounts={accounts}
                onSubmit={handleManualSubmit}
                initialBalanceDate={initialBalanceDate}
                setInitialBalanceDate={setInitialBalanceDate}
                existingInitialBalanceTx={existingInitialBalanceTx}
                initialData={balanceEntries} // 👈 REQUIRED
              />
            </>
          )}

          {/* ========================= */}
          {/* PREVIEW                   */}
          {/* ========================= */}

          {balanceEntries.length > 0 && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-lg font-bold text-blue-800 mb-3">
                🧾 Balance Inicial (vista previa)
              </h3>

              <BalanceSheet
                entries={balanceEntries}
                entityId={entityId}
                showHeader={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}