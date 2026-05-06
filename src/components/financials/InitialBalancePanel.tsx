// ============================================================================
// components/InitialBalancePanel.tsx
// CONTILISTO — ACCOUNTING-SAFE INITIAL BALANCE PANEL (IMPROVED)
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
import type { BalanceEntry } from "@/types/BalanceTypes";

/* ========================================================================== */
/* CONFIG                                                                     */
/* ========================================================================== */

interface Props {
  entityId: string;
  userIdSafe: string;
  accounts: Account[];
  editMode?: boolean;
  /** When true the panel is always visible without the toggle button */
  alwaysOpen?: boolean;
}

const INITIAL_SOURCE: EntrySource = "initial";

const getInitialTxId = (entityId: string) =>
  `INITIAL_BALANCE:${entityId}`;

/* ========================================================================== */
/* HELPERS                                                                    */
/* ========================================================================== */

function extractAmount(e: unknown): { debit: number; credit: number } {
  const entry = e as any;

  if ("debit" in entry || "credit" in entry) {
    return {
      debit: Number(entry.debit ?? 0),
      credit: Number(entry.credit ?? 0),
    };
  }

  if ("value" in entry) {
    const value = Number(entry.value ?? 0);
    return {
      debit: value > 0 ? value : 0,
      credit: value < 0 ? Math.abs(value) : 0,
    };
  }

  return { debit: 0, credit: 0 };
}

function accountGroup(code: string): "1" | "2" | "3" | "other" {
  const g = code.trim().charAt(0);
  return g === "1" || g === "2" || g === "3" ? g : "other";
}

function normalizeInitialSide(
  code: string,
  debit: number,
  credit: number
) {
  if (debit < 0 || credit < 0) {
    throw new Error("No se permiten valores negativos.");
  }

  if (debit > 0 && credit > 0) {
    throw new Error(`La cuenta ${code} no puede tener débito y crédito.`);
  }

  const amount = debit > 0 ? debit : credit;
  if (amount <= 0) return { debit: 0, credit: 0 };

  const group = accountGroup(code);

  if (group === "1") return { debit: amount, credit: 0 };
  if (group === "2" || group === "3") return { debit: 0, credit: amount };

  return { debit, credit };
}

function buildInitialEntry(
  base: Partial<JournalEntry>,
  entityId: string,
  userIdSafe: string,
  date: string
): JournalEntry {
  return {
    entityId,
    uid: userIdSafe,
    transactionId: getInitialTxId(entityId),
    transactionType: "initial_balance",
    documentNature: "opening",
    source: INITIAL_SOURCE,
    description: "Balance Inicial",
    date,
    createdAt: Date.now(),
    debit: Number(base.debit ?? 0),
    credit: Number(base.credit ?? 0),
    ...base,
  } as JournalEntry;
}

/* ========================================================================== */
/* COMPONENT                                                                  */
/* ========================================================================== */

export default function InitialBalancePanel({
  entityId,
  userIdSafe,
  accounts,
  editMode = false,
  alwaysOpen = false,
}: Props) {
  const { user } = useAuth();

  const [showPanel, setShowPanel] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [saved, setSaved] = useState(false);
  const [exists, setExists] = useState(false);

  const [date, setDate] = useState(getDefaultInitialBalanceDate());

  /* ------------------------------------------------------------------------ */
  /* LOAD EXISTING                                                            */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const all = await fetchJournalEntries(entityId);
      const txId = getInitialTxId(entityId);

      const has = all.some(
        (e) => e.source === "initial" && e.transactionId === txId
      );

      if (!cancelled) setExists(has);
    })();

    return () => {
      cancelled = true;
    };
  }, [entityId]);

  useEffect(() => {
    if (!editMode) return;

    (async () => {
      const all = await fetchJournalEntries(entityId);
      const txId = getInitialTxId(entityId);

      const initial = all.filter(
        (e) => e.source === "initial" && e.transactionId === txId
      );

      setEntries(initial);
      setShowPanel(true);
    })();
  }, [editMode, entityId]);

  /* ------------------------------------------------------------------------ */
  /* VALIDATION                                                               */
  /* ------------------------------------------------------------------------ */

  function validate(entries: JournalEntry[]) {
    if (!entries.length) throw new Error("Debe ingresar al menos una línea.");

    let d = 0;
    let c = 0;

    for (const e of entries) {
      const debit = Number(e.debit ?? 0);
      const credit = Number(e.credit ?? 0);

      const g = accountGroup(e.account_code);

      if ((g === "2" || g === "3") && debit > 0) {
        throw new Error(`La cuenta ${e.account_code} debe ir al crédito.`);
      }

      if (g === "1" && credit > 0) {
        throw new Error(`La cuenta ${e.account_code} debe ir al débito.`);
      }

      d += debit;
      c += credit;
    }

    if (Math.abs(d - c) >= 0.01) {
      throw new Error("El balance no cuadra.");
    }
  }

  /* ------------------------------------------------------------------------ */
  /* SAVE                                                                     */
  /* ------------------------------------------------------------------------ */

  async function persist(list: JournalEntry[]) {
    const txId = getInitialTxId(entityId);
    const all = await fetchJournalEntries(entityId);

    const already = all.some(
      (e) => e.source === "initial" && e.transactionId === txId
    );

    if (already && !editMode) {
      throw new Error("Ya existe Balance Inicial.");
    }

    if (already && editMode) {
      if (!user?.uid) throw new Error("Usuario inválido");

      await deleteJournalEntriesByTransactionId(entityId, txId);
    }

    await saveJournalEntries(entityId, userIdSafe, list);

    setExists(true);
  }

  /* ------------------------------------------------------------------------ */
  /* TRANSFORM                                                                */
  /* ------------------------------------------------------------------------ */

  function transform(input: any[]): JournalEntry[] {
    return input.map((e) => {
      const code = (e.account_code ?? "").trim();
      if (!code) throw new Error("Cuenta inválida");

      const { debit, credit } = extractAmount(e);
      const side = normalizeInitialSide(code, debit, credit);

      return buildInitialEntry(
        {
          account_code: code,
          account_name: (e.account_name ?? "").trim(),
          debit: side.debit,
          credit: side.credit,
        },
        entityId,
        userIdSafe,
        date
      );
    });
  }

  /* ------------------------------------------------------------------------ */
  /* HANDLERS                                                                 */
  /* ------------------------------------------------------------------------ */

  async function handleManual(data: ManualBalanceEntry[]) {
    try {
      const normalized = transform(data);
      validate(normalized);

      setEntries(normalized);
      await persist(normalized);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleUpload(data: BalanceEntry[]) {
    try {
      const normalized = transform(data);
      validate(normalized);

      setEntries(normalized);
      await persist(normalized);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert(e.message);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* RENDER                                                                   */
  /* ------------------------------------------------------------------------ */

  const panelVisible = alwaysOpen || showPanel;

  return (
    <div className={alwaysOpen ? "" : "mt-8 border rounded shadow p-4 bg-white"}>
      {!alwaysOpen && (
        <div className="flex justify-between items-center">
          {!editMode && (
            <button
              onClick={() => setShowPanel((p) => !p)}
              className="px-4 py-2 bg-blue-700 text-white rounded"
            >
              🧾 {showPanel ? "Ocultar" : "Carga el Balance Inicial"}
            </button>
          )}
          {saved && (
            <span className="text-green-600 font-semibold">✅ Guardado</span>
          )}
        </div>
      )}

      {saved && alwaysOpen && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 font-semibold text-sm">
          ✅ Balance inicial guardado correctamente.
        </div>
      )}

      {panelVisible && (
        <div className="mt-4 space-y-6">

          {!exists && !editMode && (
            <>
              <ManualBalanceForm
                entityId={entityId}
                accounts={accounts}
                onSubmit={handleManual}
                initialBalanceDate={date}
                setInitialBalanceDate={setDate}
                existingInitialBalanceTx={exists}
              />

              <BalancePDFUploader onUploadComplete={handleUpload} />
            </>
          )}

          {editMode && (
            <ManualBalanceForm
              entityId={entityId}
              accounts={accounts}
              onSubmit={handleManual}
              initialBalanceDate={date}
              setInitialBalanceDate={setDate}
              existingInitialBalanceTx={exists}
              initialData={entries}
            />
          )}

          {entries.length > 0 && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-lg font-bold text-blue-800 mb-3">
                🧾 Vista previa
              </h3>

              <BalanceSheet
                entries={entries}
                entityId={entityId}
                resultadoDelEjercicio={0}
                showHeader={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}