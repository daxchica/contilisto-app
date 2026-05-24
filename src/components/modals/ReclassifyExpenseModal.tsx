// ============================================================================
// src/components/modals/ReclassifyExpenseModal.tsx
// CONTILISTO — Reclassify a personal expense as a business journal entry.
//
// Shown when an accountant clicks "Reclasificar" on a personal expense line.
// The accountant selects the correct expense account; the modal builds
// and saves the journal entry, then removes the record from personalExpenses.
// ============================================================================

import React, { useState, useMemo } from "react";
import type { Account } from "@/types/AccountTypes";
import type { PersonalExpenseRecord } from "@/types/PersonalExpenseRecord";
import AccountPicker from "@/components/AccountPicker";
import { reclassifyPersonalExpenseToJournal } from "@/services/reclassifyExpenseService";

// ─────────────────────────────────────────────────────────────────────────────

const USD = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  record: PersonalExpenseRecord | null;
  entityId: string;
  uid: string;
  /** Full chart of accounts for the entity (already loaded by the parent page) */
  accounts: Account[];
  onClose: () => void;
  /** Called after a successful reclassification so the parent can refresh */
  onSuccess: (transactionId: string) => void;
}

export default function ReclassifyExpenseModal({
  record,
  entityId,
  uid,
  accounts,
  onClose,
  onSuccess,
}: Props) {
  const [selectedAccount, setSelectedAccount] = useState<{ code: string; name: string } | null>(null);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  // Filter accounts to expense/cost groups (5xx and 6xx)
  const expenseAccounts = useMemo(
    () => accounts.filter((a) => {
      const code = String(a.code ?? "").replace(/\./g, "");
      return code.startsWith("5") || code.startsWith("6");
    }),
    [accounts]
  );

  if (!record) return null;

  const handleConfirm = async () => {
    setError("");
    if (!selectedAccount) {
      setError("Selecciona la cuenta contable de gasto empresarial.");
      return;
    }
    setSaving(true);
    try {
      await reclassifyPersonalExpenseToJournal(
        entityId,
        uid,
        record,
        selectedAccount.code,
        selectedAccount.name,
      );
      onSuccess(record.transactionId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al reclasificar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-amber-50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔄</span>
            <div>
              <h2 className="text-base font-bold text-gray-900">Reclasificar gasto personal</h2>
              <p className="text-xs text-amber-700 mt-0.5">
                El comprobante pasará al diario contable como gasto empresarial
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* ── Invoice summary ─────────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="text-gray-500 text-xs uppercase tracking-wide">No. Factura</span>
              <p className="font-mono font-semibold text-gray-800">{record.invoice_number || "—"}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs uppercase tracking-wide">Fecha</span>
              <p className="text-gray-800">{record.date}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500 text-xs uppercase tracking-wide">Proveedor / Emisor</span>
              <p className="text-gray-800 font-medium">{record.supplierName}</p>
              <p className="text-gray-400 text-xs font-mono">{record.supplierRUC}</p>
            </div>
          </div>

          {/* Amounts */}
          <div className="mt-3 flex gap-6 text-sm">
            <div>
              <span className="text-gray-500 text-xs">Base</span>
              <p className="font-semibold tabular-nums text-gray-800">${USD(record.amount)}</p>
            </div>
            {record.iva > 0 && (
              <div>
                <span className="text-gray-500 text-xs">IVA</span>
                <p className="font-semibold tabular-nums text-gray-800">${USD(record.iva)}</p>
              </div>
            )}
            <div>
              <span className="text-gray-500 text-xs">Total</span>
              <p className="font-bold tabular-nums text-gray-900">${USD(record.total)}</p>
            </div>
            <div className="ml-auto text-right">
              <span className="text-gray-500 text-xs">Categoría personal actual</span>
              <p className="text-amber-700 font-medium text-xs">{record.category}</p>
            </div>
          </div>
        </div>

        {/* ── Account selector ────────────────────────────────────────────── */}
        <div className="px-6 py-5">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Cuenta contable de gasto empresarial
            <span className="text-red-500 ml-1">*</span>
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Selecciona la cuenta de gastos / costos (grupo 5 o 6) a la que
            corresponde este desembolso como gasto de la empresa.
          </p>
          <AccountPicker
            value={selectedAccount}
            onChange={setSelectedAccount}
            accounts={expenseAccounts}
            placeholder="Buscar cuenta de gastos…"
            displayMode="code+name"
          />

          {/* Journal preview */}
          {selectedAccount && (
            <div className="mt-4 rounded-lg border border-gray-200 overflow-hidden text-xs">
              <div className="bg-gray-100 px-3 py-1.5 text-gray-500 uppercase tracking-wide font-medium text-[10px]">
                Asiento que se generará
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b text-gray-400 text-[10px]">
                    <th className="text-left px-3 py-1.5">Cuenta</th>
                    <th className="text-right px-3 py-1.5">Debe</th>
                    <th className="text-right px-3 py-1.5">Haber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="bg-white">
                    <td className="px-3 py-1.5 text-gray-700">
                      <span className="font-mono text-gray-400">{selectedAccount.code}</span>{" "}
                      {selectedAccount.name}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-green-700">${USD(record.amount)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-300">—</td>
                  </tr>
                  {record.iva > 0 && (
                    <tr className="bg-white">
                      <td className="px-3 py-1.5 text-gray-700">
                        <span className="font-mono text-gray-400">1330101</span>{" "}
                        IVA crédito en compras
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-green-700">${USD(record.iva)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-300">—</td>
                    </tr>
                  )}
                  <tr className="bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-700">
                      <span className="font-mono text-gray-400">201030102</span>{" "}
                      Cuentas por pagar
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-300">—</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-red-700">${USD(record.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || !selectedAccount}
            className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-sm font-semibold transition flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full inline-block" />
                Reclasificando…
              </>
            ) : (
              "✓ Confirmar reclasificación"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
