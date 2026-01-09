// ============================================================================
// src/components/JournalPreviewModal.tsx
// CONTILISTO — FINAL STABLE VERSION
// Reuses ManualEntryModal row logic
// ============================================================================

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Rnd } from "react-rnd";

import type { Account } from "../../types/AccountTypes";
import type { JournalEntry } from "../../types/JournalEntry";

import AccountPicker from "../AccountPicker";
import { saveContextualAccountHint } from "@/services/firestoreHintsService";

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

type Row = JournalEntry & {
  _debitRaw?: string;
  _creditRaw?: string;
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const todayISO = () => new Date().toISOString().slice(0, 10);

function isLeafAccount(account: Account, all: Account[]) {
  if ((account as any).isLastLevel) return true;
  if (account.code.length >= 7) return true;
  return !all.some(
    (a) => a.code !== account.code && a.code.startsWith(account.code)
  );
}

function createEmptyRow(
  entityId: string,
  userId: string
): Row {
  return {
    id: crypto.randomUUID(),
    entityId,
    uid: userId,
    date: todayISO(),
    account_code: "",
    account_name: "",
    debit: 0,
    credit: 0,
    description: "",
    source: "edited",
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// COMPONENT
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
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // -------------------------------------------------------------------------
  // CENTERED MODAL (DRAGGABLE)
  // -------------------------------------------------------------------------

  const MODAL_WIDTH = 900;

  const [position, setPosition] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const x = Math.max(20, (window.innerWidth - MODAL_WIDTH) / 2);
    const y = Math.max(20, (window.innerHeight - 500) / 2);
    setPosition({ x, y });
  }, []);

  // -------------------------------------------------------------------------
  // ACCOUNTS
  // -------------------------------------------------------------------------

  const leafAccounts = useMemo(
    () => accounts.filter((a) => isLeafAccount(a, accounts)),
    [accounts]
  );

  // -------------------------------------------------------------------------
  // INIT
  // -------------------------------------------------------------------------

  useEffect(() => {
    const prepared: Row[] = entries.map((e) => ({
      ...e,
      id: e.id ?? crypto.randomUUID(),
      debit: e.debit ?? 0,
      credit: e.credit ?? 0,
      date: e.date ?? todayISO(),
    }));

    setRows(prepared);

    const mainExpense = prepared.find((e) =>
      e.account_code?.startsWith("5")
    );

    const invoice = metadata?.invoice_number ?? "";
    const desc = mainExpense?.account_name ?? "";

    setNote(
      invoice && desc
        ? `Factura ${invoice} - ${desc}`
        : invoice || desc
    );
  }, [entries, metadata]);

  // -------------------------------------------------------------------------
  // TOTALS
  // -------------------------------------------------------------------------

  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + (r.debit ?? 0), 0);
    const credit = rows.reduce((s, r) => s + (r.credit ?? 0), 0);
    return {
      debit,
      credit,
      diff: debit - credit,
      balanced: Math.abs(debit - credit) < 0.01,
    };
  }, [rows]);

  // -------------------------------------------------------------------------
  // ROW ACTIONS
  // -------------------------------------------------------------------------

  const patchRow = (idx: number, patch: Partial<Row>) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      createEmptyRow(entityId, userId),
    ]);
  };

  const duplicateRow = () => {
    if (selectedIdx == null) return;
    const copy = {
      ...rows[selectedIdx],
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setRows((prev) => {
      const next = [...prev];
      next.splice(selectedIdx + 1, 0, copy);
      return next;
    });
    setSelectedIdx(selectedIdx + 1);
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setSelectedIdx(null);
  };

  // -------------------------------------------------------------------------
  // SAVE
  // -------------------------------------------------------------------------

  const handleSave = async () => {
    if (!totals.balanced || saving) return;

    try {
      setSaving(true);

      await onSave(rows, note);

      // 🧠 CONTEXTUAL LEARNING (post-confirmation)
      const supplierRUC = metadata?.issuerRUC;
      const supplierName = metadata?.issuerName;

      if (supplierRUC) {
        for (const r of rows) {
          if (
            (r.debit ?? 0) > 0 &&
            r.account_code &&
            !r.account_code.startsWith("133") &&
            !r.account_code.startsWith("201")
          ) {
            await saveContextualAccountHint(
              userId,
              supplierRUC,
              supplierName,
              note,
              r.account_code,
              r.account_name ?? ""
            );
          }
        }
      }

      onClose();
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      <Rnd
        position={position}
        size={{ width: MODAL_WIDTH, height: "auto" }}
        enableResizing={false}
        dragHandleClassName="drag-header"
        bounds="window"
        className="bg-white rounded-xl shadow-2xl"
      >
        {/* HEADER */}
        <div className="drag-header bg-blue-600 text-white px-4 py-3 rounded-t-xl flex justify-between items-center cursor-move">
          <span className="font-semibold">
            Vista previa de asiento contable IA
          </span>
          <button onClick={onClose}>✖</button>
        </div>

        {/* BODY */}
        <div className="p-5 space-y-4">
          {/* METADATA */}
          <div className="grid grid-cols-2 gap-2 text-sm bg-gray-100 p-3 rounded">
            <div><b>Proveedor:</b> {metadata?.issuerName}</div>
            <div><b>RUC:</b> {metadata?.issuerRUC}</div>
            <div><b>Factura:</b> {metadata?.invoice_number}</div>
            <div><b>Fecha:</b> {metadata?.invoiceDate}</div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex justify-end gap-2">
            <button onClick={addRow} className="px-3 py-1 bg-emerald-600 text-white rounded">
              ➕ Agregar
            </button>
            <button onClick={duplicateRow} className="px-3 py-1 bg-indigo-600 text-white rounded">
              ⧉ Duplicar
            </button>
          </div>

          {/* TABLE */}
          <table className="w-full text-sm border">
            <thead className="bg-gray-200">
              <tr>
                <th className="border p-2 w-[140px]">Código</th>
                <th className="border p-2 min-w-[360px]">Cuenta</th>
                <th className="border p-2 w-[140px] text-right">Débito</th>
                <th className="border p-2 w-[140px] text-right">Crédito</th>
                <th className="border p-2 w-[60px]" />
              </tr>
            </thead>

            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedIdx(idx)}
                  className={selectedIdx === idx ? "bg-emerald-50" : ""}
                >
                  <td className="border p-2 font-mono">{r.account_code}</td>

                  <td className="border p-2">
                    <AccountPicker
                      accounts={leafAccounts}
                      value={{
                        code: r.account_code ?? "",
                        name: r.account_name ?? "",
                      }}
                      onChange={(acc) =>
                        patchRow(idx, {
                          account_code: acc.code,
                          account_name: acc.name,
                        })
                      }
                    />
                  </td>

                  <td className="border p-2 text-right">
                    <input
                      className="w-full border rounded px-2 py-1 text-right"
                      value={
                        r._debitRaw ??
                        (r.debit !== undefined && r.debit !== 0
                          ? r.debit.toString()
                          : "")
                      }
                      onChange={(e) => {
                        patchRow(idx, {
                          _debitRaw: e.target.value,
                          debit: parseFloat(e.target.value) || 0,
                          credit: 0,
                        });
                      }}
                    />
                  </td>

                  <td className="border p-2 text-right">
                    <input
                      className="w-full border rounded px-2 py-1 text-right"
                      value={
                        r._creditRaw ??
                        (r.credit !== undefined && r.credit !== 0
                          ? r.credit.toString()
                          : "")
                      }
                      onChange={(e) => {
                        patchRow(idx, {
                          _creditRaw: e.target.value,
                          credit: parseFloat(e.target.value) || 0,
                          debit: 0,
                        });
                      }}
                    />
                  </td>

                  <td className="border p-2 text-center">
                    <button onClick={() => removeRow(idx)}>✖</button>
                  </td>
                </tr>
              ))}

              <tr className="font-bold bg-gray-100">
                <td />
                <td className="text-right p-2">Totales</td>
                <td className="text-right p-2">{totals.debit.toFixed(2)}</td>
                <td className="text-right p-2">{totals.credit.toFixed(2)}</td>
                <td className="text-center">
                  {totals.balanced ? "✔" : "⚠"}
                </td>
              </tr>
            </tbody>
          </table>

          {/* NOTE */}
          <div className="flex gap-3 items-center">
            <input
              className="flex-1 border rounded px-3 py-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <span className={totals.balanced ? "text-green-600" : "text-red-600"}>
              {totals.balanced ? "✔ Balanceado" : "⚠ Desbalance"}
            </span>
          </div>

          {/* FOOTER */}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!totals.balanced || saving}
              className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
            >
              Confirmar Asiento
            </button>
          </div>
        </div>
      </Rnd>
    </div>
  );
}