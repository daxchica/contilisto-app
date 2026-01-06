// ============================================================================
// src/components/JournalPreviewModal.tsx
// CONTILISTO ARCHITECTURE v1.0
// ============================================================================

import React, { useState, useEffect, useMemo, useLayoutEffect } from "react";
import { Rnd } from "react-rnd";

import type { Account } from "../../types/AccountTypes";
import type { JournalEntry } from "../../types/JournalEntry";
import AccountPicker from "../AccountPicker";
import {
  fetchAccountHintsBySupplierRUC,
  saveAccountHint,
} from "@/services/accountHintService";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface Props {
  entries: JournalEntry[];
  metadata: any;
  accounts: Account[];
  entityId: string;
  userId: string;
  onClose: () => void;
  onSave: (entries: JournalEntry[], note: string) => Promise<void>;
}

type LocalEntry = JournalEntry;

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function isLeafAccount(account: Account, all: Account[]): boolean {
  if ((account as any).isLastLevel === true) return true;
  if (account.code.length >= 9) return true;
  return !all.some(
    (other) =>
      other.code !== account.code && other.code.startsWith(account.code)
  );
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export default function JournalPreviewModal({
  entries,
  metadata,
  accounts,
  entityId,
  userId,
  onClose,
  onSave,
}: Props) {
  const [localEntries, setLocalEntries] = useState<LocalEntry[]>([]);
  const [note, setNote] = useState("");
  const [hints, setHints] = useState<{ code: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // -------------------------------------------------------------------------
  // CENTERED MODAL
  // -------------------------------------------------------------------------

  const MODAL_W = 900;
  const MODAL_H = 600;

  const [rndDefault, setRndDefault] = useState({
    x: 0,
    y: 0,
    width: MODAL_W,
    height: MODAL_H,
  });

  useLayoutEffect(() => {
    const compute = () => {
      const w = Math.min(MODAL_W, window.innerWidth - 40);
      const h = Math.min(MODAL_H, window.innerHeight - 40);
      const x = Math.max(20, Math.round((window.innerWidth - w) / 2));
      const y = Math.max(20, Math.round((window.innerHeight - h) / 2));
      setRndDefault({ x, y, width: w, height: h });
    };

    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // -------------------------------------------------------------------------
  // ACCOUNTS
  // -------------------------------------------------------------------------

  const availableAccounts = useMemo(
    () => accounts.filter((a) => isLeafAccount(a, accounts)),
    [accounts]
  );

  // -------------------------------------------------------------------------
  // INIT
  // -------------------------------------------------------------------------

  useEffect(() => {
    setLocalEntries(
      entries.map((e) => ({
        ...e,
        id: e.id || crypto.randomUUID(),
      }))
    );

    const mainExpense = entries.find((e) => e.account_code?.startsWith("5"));
    const invoice =
      metadata?.invoice_number || entries[0]?.invoice_number || "";
    const desc = mainExpense?.account_name || "";

    setNote(
      invoice && desc
        ? `Factura ${invoice} - ${desc}`
        : invoice || desc || ""
    );

    async function loadHints() {
      if (!metadata?.issuerRUC) return;
      const data = await fetchAccountHintsBySupplierRUC(metadata.issuerRUC);
      setHints(
        data.map((h: any) => ({
          code: h.accountCode,
          name: h.accountName,
        }))
      );
    }

    loadHints().catch(console.error);
  }, [entries, metadata]);

  // -------------------------------------------------------------------------
  // TOTALS
  // -------------------------------------------------------------------------

  const { totalDebit, totalCredit, isBalanced, diff } = useMemo(() => {
    const d = localEntries.reduce((s, e) => s + (Number(e.debit) || 0), 0);
    const c = localEntries.reduce((s, e) => s + (Number(e.credit) || 0), 0);
    const delta = d - c;

    return {
      totalDebit: d,
      totalCredit: c,
      diff: delta,
      isBalanced: Math.abs(delta) < 0.0001,
    };
  }, [localEntries]);

  // -------------------------------------------------------------------------
  // AccountChange (updates LOCAL state + saves hint)
  // -------------------------------------------------------------------------

  function handleAccountChange(
    index: number,
    account: { code: string; name: string }
  ) {
    setLocalEntries((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        account_code: account.code,
        account_name: account.name,
        source: "edited",
      };
      return copy;
    });

    if (metadata?.issuerRUC) {
      saveAccountHint({
        supplierRUC: metadata.issuerRUC,
        accountCode: account.code,
        accountName: account.name,
        userId,
      }).catch(console.error);
    }
  }

  // -------------------------------------------------------------------------
  // SAVE
  // -------------------------------------------------------------------------

  async function handleSave() {
    if (!isBalanced) {
      alert("El asiento no está balanceado");
      return;
    }
    if (saving) return;

    try {
      setSaving(true);

      const fixed = localEntries.map((e) => ({
        ...e,
        entityId,
        uid: userId,
        userId,
        description: note,
        createdAt: e.createdAt ?? Date.now(),
        source: e.source ?? "edited",
      }));

      await onSave(fixed, note);
    } catch (err) {
      console.error(err);
      alert("Error guardando el asiento. Revisa la consola.");
    } finally {
      setSaving(false);
    }
  }

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 bg-black/60">
      <Rnd
        key={`${rndDefault.x}-${rndDefault.y}`}
        default={rndDefault}
        minWidth={800}
        minHeight={480}
        enableResizing={false}
        dragHandleClassName="drag-header"
        bounds="window"
        className="bg-white rounded-xl shadow-2xl flex flex-col"
      >
        {/* HEADER */}
        <div className="drag-header bg-blue-600 text-white p-4 rounded-t-xl flex justify-between cursor-move">
          <h2 className="font-bold">Vista previa de asiento contable IA</h2>
          <button onClick={onClose}>✖</button>
        </div>

        {/* BODY */}
        <div className="flex-1 p-6 overflow-auto">
          {/* METADATA */}
          <div className="mb-4 grid grid-cols-2 gap-2 text-sm bg-gray-100 p-3 rounded">
            <div>
              <b>Proveedor:</b> {metadata?.issuerName}
            </div>
            <div>
              <b>RUC:</b> {metadata?.issuerRUC}
            </div>
            <div>
              <b>Factura:</b> {metadata?.invoice_number}
            </div>
            <div>
              <b>Fecha:</b> {metadata?.invoiceDate}
            </div>
          </div>

          {/* TABLE */}
          <table className="w-full text-sm border">
            <thead className="bg-gray-200">
              <tr>
                <th className="border p-2">Código</th>
                <th className="border p-2">Cuenta</th>
                <th className="border p-2">Débito</th>
                <th className="border p-2">Crédito</th>
              </tr>
            </thead>

            <tbody>
              {localEntries.map((e, i) => (
                <tr key={e.id}>
                  <td className="border p-2 font-mono">{e.account_code}</td>

                  <td className="border p-2">
                    <AccountPicker
                      accounts={availableAccounts}
                      hints={hints}
                      value={{
                        code: e.account_code ?? "",
                        name: e.account_name ?? "",
                      }}
                      onChange={(account) => handleAccountChange(i, account)}
                    />
                  </td>

                  <td className="border p-2 text-right">{e.debit}</td>
                  <td className="border p-2 text-right">{e.credit}</td>
                </tr>
              ))}

              {/* ✅ FIXED totals row to match 4 columns */}
              <tr className="font-bold bg-gray-100">
                <td className="border p-2" />
                <td className="border p-2 text-right">Totales</td>
                <td className="border p-2 text-right">
                  {totalDebit.toFixed(2)}
                </td>
                <td className="border p-2 text-right">
                  {totalCredit.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* NOTE */}
          <div className="mt-4 flex items-center gap-3">
            <input
              className="flex-1 border rounded px-3 py-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {isBalanced ? (
              <span className="text-green-600">✔ Balanceado</span>
            ) : (
              <span className="text-red-600">⚠ Diferencia {diff.toFixed(2)}</span>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t flex justify-end gap-3 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!isBalanced || saving}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Confirmar Asiento"}
          </button>
        </div>
      </Rnd>
    </div>
  );
}