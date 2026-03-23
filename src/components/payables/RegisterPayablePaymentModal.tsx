// ============================================================================
// Register payable payment (Accounts Payable)
// ACCOUNTING SAFE FLOW:
// 1) Bank Movement
// 2) Journal Entry
// ECUADOR SAFE RETENTIONS:
// - IR retention is calculated on expense base
// - IVA retention is calculated on invoice IVA
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { Rnd } from "react-rnd";

import type { Payable } from "@/types/Payable";
import type { JournalEntry } from "@/types/JournalEntry";

import {
  createBankMovement,
  type BankMovement,
} from "@/services/bankMovementService";

import {
  createPayablePaymentJournalEntry,
  fetchJournalEntriesByTransactionId,
} from "@/services/journalService";

import { repairPayableAccountFromJournal } from "@/services/payablesService";
import { normalizeAccountCode } from "@/utils/normalizeAccountCode";
import type { BankAccount } from "@/types/bankTypes";

type Props = {
  isOpen: boolean;
  entityId: string;
  userIdSafe: string;
  payable: Payable | null;
  bankAccounts: BankAccount[];
  onClose: () => void;
  onSaved?: () => void;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function safeMoney(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function round2(v: number): number {
  return Number(Number(v || 0).toFixed(2));
}

function resolveBankGLCode(bank: BankAccount): string {
  const code = bank.account_code?.toString().trim();

  if (!code) {
    throw new Error("La cuenta bancaria no tiene cuenta contable asignada.");
  }

  return normalizeAccountCode(code as any);
}

function calcRetentionFromPercent(base: number, percent: number) {
  return round2((base * percent) / 100);
}

function normCode(code?: string): string {
  return String(code ?? "").replace(/\./g, "").trim();
}

function getExpenseAndIVAFromJournal(entries: JournalEntry[]) {
  let expenseBase = 0;
  let ivaAmount = 0;

  for (const e of entries) {
    const code = normCode(e.account_code);
    const debit = Number(e.debit ?? 0);
    const credit = Number(e.credit ?? 0);

    if (credit > 0) continue;

    if (code.startsWith("5") && debit > 0) {
      expenseBase += debit;
    }

    if (
      debit > 0 &&
      (
        code === "1330101" ||
        code === "133010101" ||
        code === "133010102" ||
        code.startsWith("133")
      )
    ) {
      ivaAmount += debit;
    }
  }

  return {
    expenseBase: round2(expenseBase),
    ivaAmount: round2(ivaAmount),
  };
}

function resolvePayableAccountFromJournal(
  entries: JournalEntry[]
): { account_code: string; account_name: string } | null {
  const control = entries.find((e) => {
    const code = normCode(e.account_code);
    const credit = Number(e.credit ?? 0);
    return code.startsWith("20103") && credit > 0;
  });

  if (!control?.account_code) return null;

  return {
    account_code: normCode(control.account_code),
    account_name: String(control.account_name ?? "Proveedores").trim(),
  };
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function RegisterPayablePaymentModal({
  isOpen,
  entityId,
  userIdSafe,
  payable,
  bankAccounts,
  onClose,
  onSaved,
}: Props) {
  const [localPayable, setLocalPayable] = useState<Payable | null>(null);
  const [paymentDate, setPaymentDate] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");

  const [saving, setSaving] = useState(false);
  const [loadingBases, setLoadingBases] = useState(false);
  const [error, setError] = useState("");

  const [needsRepair, setNeedsRepair] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const [applyIR, setApplyIR] = useState(false);
  const [applyIVA, setApplyIVA] = useState(false);

  const [retentionIR, setRetentionIR] = useState("");
  const [retentionIVA, setRetentionIVA] = useState("");

  const [expenseBase, setExpenseBase] = useState(0);
  const [invoiceIVA, setInvoiceIVA] = useState(0);

  const [modalPosition, setModalPosition] = useState({
    x: 0,
    y: 0,
  });

  /* -------------------------------------------------------------------------- */
  /* Init                                                                       */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    if (!isOpen) return;

    setModalPosition({
      x: Math.max(12, window.innerWidth / 2 - 320),
      y: 24,
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !payable) return;

    setLocalPayable(payable);
    setPaymentDate(new Date().toISOString().slice(0, 10));

    setBankAccountId(
      bankAccounts.length === 1 ? bankAccounts[0]?.id ?? "" : ""
    );

    setError("");
    setNeedsRepair(false);
    setApplyIR(false);
    setApplyIVA(false);
    setRetentionIR("");
    setRetentionIVA("");
    setExpenseBase(0);
    setInvoiceIVA(0);
  }, [isOpen, payable, bankAccounts]);

  /* -------------------------------------------------------------------------- */
  /* Load invoice bases from original journal                                   */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    async function loadBases() {
      if (!isOpen || !payable?.transactionId || !entityId) return;

      try {
        setLoadingBases(true);

        const journalEntries = await fetchJournalEntriesByTransactionId(
          entityId,
          payable.transactionId
        );

        const { expenseBase, ivaAmount } =
          getExpenseAndIVAFromJournal(journalEntries);

        setExpenseBase(expenseBase);
        setInvoiceIVA(ivaAmount);
      } catch (err) {
        console.error("No se pudieron cargar las bases de retención:", err);
        setExpenseBase(0);
        setInvoiceIVA(0);
      } finally {
        setLoadingBases(false);
      }
    }

    loadBases();
  }, [isOpen, payable?.transactionId, entityId]);

  /* -------------------------------------------------------------------------- */
  /* Derived values                                                             */
  /* -------------------------------------------------------------------------- */

  const currentPayable = localPayable ?? payable;

  const selectedBank = useMemo(
    () => bankAccounts.find((b) => b.id === bankAccountId),
    [bankAccounts, bankAccountId]
  );

  const invoiceTotal = useMemo(() => {
    return round2(Number(currentPayable?.balance ?? 0));
  }, [currentPayable?.balance]);

  const numericRetentionIR = useMemo(
    () => safeMoney(retentionIR),
    [retentionIR]
  );

  const numericRetentionIVA = useMemo(
    () => safeMoney(retentionIVA),
    [retentionIVA]
  );

  const totalRetentions = useMemo(() => {
    return round2(
      (applyIR ? numericRetentionIR : 0) +
      (applyIVA ? numericRetentionIVA : 0)
    );
  }, [applyIR, applyIVA, numericRetentionIR, numericRetentionIVA]);

  const bankPaymentAmount = useMemo(() => {
    return round2(Math.max(0, invoiceTotal - totalRetentions));
  }, [invoiceTotal, totalRetentions]);

  const appliedTotal = useMemo(() => {
    return round2(
      bankPaymentAmount +
      (applyIR ? numericRetentionIR : 0) +
      (applyIVA ? numericRetentionIVA : 0)
    );
  }, [
    bankPaymentAmount,
    applyIR,
    applyIVA,
    numericRetentionIR,
    numericRetentionIVA,
  ]);

  const difference = useMemo(() => {
    return round2(appliedTotal - invoiceTotal);
  }, [appliedTotal, invoiceTotal]);

  const exceedsInvoice = totalRetentions > invoiceTotal;
  const belowInvoice = false;
  const isBalanced = !exceedsInvoice && Math.abs(difference) <= 0.009;

  console.log("SELECTED BANK FULL OBJECT", selectedBank);

  /* -------------------------------------------------------------------------- */
  /* Guard AFTER hooks                                                          */
  /* -------------------------------------------------------------------------- */

  if (!isOpen || !currentPayable) return null;

  const p = currentPayable;

  /* -------------------------------------------------------------------------- */
  /* Retention preset handlers                                                  */
  /* -------------------------------------------------------------------------- */

  function applyIRPreset(percent: number) {
    const value = calcRetentionFromPercent(expenseBase, percent);
    setRetentionIR(value.toFixed(2));
  }

  function applyIVAPreset(percent: number) {
    const value = calcRetentionFromPercent(invoiceIVA, percent);
    setRetentionIVA(value.toFixed(2));
  }

  /* -------------------------------------------------------------------------- */
  /* Save payment                                                               */
  /* -------------------------------------------------------------------------- */

  async function handleSave() {
    try {
      setSaving(true);
      setError("");
      setNeedsRepair(false);

      if (!entityId) throw new Error("Empresa no seleccionada");
      if (!userIdSafe) throw new Error("Usuario no válido");
      if (!p.id) throw new Error("Cuenta por pagar inválida");
      if (!paymentDate) throw new Error("Fecha requerida");
      if (!selectedBank) throw new Error("Cuenta bancaria requerida");

      if (invoiceTotal <= 0) {
        throw new Error("Monto inválido");
      }

      if (applyIR && numericRetentionIR <= 0) {
        throw new Error("La retención IR debe ser mayor a cero.");
      }

      if (applyIVA && numericRetentionIVA <= 0) {
        throw new Error("La retención IVA debe ser mayor a cero.");
      }

      if (applyIR && numericRetentionIR > expenseBase) {
        throw new Error("La retención IR no puede exceder la base del gasto.");
      }

      if (applyIVA && numericRetentionIVA > invoiceIVA) {
        throw new Error("La retención IVA no puede exceder el IVA de la factura.");
      }

      if (!isBalanced) {
        throw new Error(
          "El pago más las retenciones debe ser igual al saldo de la factura."
        );
      }

      if (!p.transactionId) {
        throw new Error("La factura no tiene transactionId contable.");
      }

      const journalEntries = await fetchJournalEntriesByTransactionId(
        entityId,
        p.transactionId
      );

      if (journalEntries.length === 0) {
        throw new Error(
          "No se encontró el asiento contable original de esta factura."
        );
      }

      const hasOriginalInvoice = journalEntries.some(
        (e) => e.invoice_number === p.invoiceNumber
      );

      if (!hasOriginalInvoice) {
        console.warn(
          "Advertencia: el asiento existe pero no coincide el número de factura."
        );
      }

      let payableAccountCode = String(p.account_code ?? "").trim();
      let payableAccountName = String(p.account_name ?? "Proveedores").trim();

      if (!payableAccountCode) {
        const recovered = resolvePayableAccountFromJournal(journalEntries);

        if (!recovered) {
          setNeedsRepair(true);
          throw new Error(
            "No se pudo recuperar la cuenta contable del proveedor."
          );
        }

        payableAccountCode = recovered.account_code;
        payableAccountName = recovered.account_name;
      }

      const bankGLCode = resolveBankGLCode(selectedBank);

      const movement: BankMovement = {
        entityId,
        bankAccountId: selectedBank.id ?? "",
        date: paymentDate,
        amount: bankPaymentAmount,
        type: "out",
        description: `Pago a proveedor ${p.supplierName ?? "Proveedor"} — Factura ${p.invoiceNumber}`,
        createdBy: userIdSafe,
        reconciled: false,
      };

      if (!selectedBank.id) {
        throw new Error("La cuenta bancaria no tiene ID válido.");
      }

      if (!selectedBank.account_code?.trim()) {
        throw new Error(
          `La cuenta bancaria "${selectedBank.name}" no tiene cuenta contable asignada.`
        );
      }

      const bankMovementId = await createBankMovement(movement);

      const payableForSave: Payable = {
        ...p,
        entityId: p.entityId ?? entityId,
        account_code: payableAccountCode,
        account_name: payableAccountName,
      };

      await createPayablePaymentJournalEntry(
        entityId,
        payableForSave,
        bankPaymentAmount,
        paymentDate,
        {
          id: selectedBank.id,
          account_code: normalizeAccountCode({
            account_code: selectedBank.account_code,
          }),
          name: selectedBank.name ?? "Cuenta bancaria",
        },
        userIdSafe,
        {
          bankMovementId,
          retentionIR: applyIR ? numericRetentionIR : 0,
          retentionIVA: applyIVA ? numericRetentionIVA : 0,
        }
      );

      onSaved?.();
      onClose();
    } catch (e: any) {
      const msg = e?.message ?? "No se pudo registrar el pago";
      setError(msg);

      if (/cuenta contable/i.test(msg)) {
        setNeedsRepair(true);
      }
    } finally {
      setSaving(false);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Repair payable                                                             */
  /* -------------------------------------------------------------------------- */

  async function handleRepair() {
    try {
      setRepairing(true);
      setError("");

      if (!p.id) throw new Error("Payable inválido");

      const picked = await repairPayableAccountFromJournal(entityId, p.id);

      setLocalPayable((prev) =>
        prev
          ? {
              ...prev,
              account_code: picked.account_code,
              account_name: picked.account_name,
            }
          : prev
      );

      setNeedsRepair(false);
      setError(
        "Cuenta contable reparada correctamente. Ahora puede registrar el pago."
      );

      onSaved?.();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo reparar la cuenta contable");
      setNeedsRepair(true);
    } finally {
      setRepairing(false);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* UI                                                                         */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Rnd
        default={{
          x: Math.max(12, window.innerWidth / 2 - 320),
          y: 24,
          width: 640,
          height: 560,
        }}
        onDragStop={(_, d) => {
          setModalPosition({ x: d.x, y: d.y });
        }}
        position={modalPosition}
        enableResizing={false}
        dragHandleClassName="drag-header"
        bounds="window"
      >
        <div className="bg-white rounded-xl shadow-xl w-full">
          {/* HEADER */}
          <div className="drag-header cursor-move px-6 py-4 border-b flex justify-between">
            <div>
              <h2 className="text-lg font-bold">Registrar pago</h2>
              <p className="text-xs text-gray-500">
                {p.supplierName} • Factura {p.invoiceNumber}
              </p>
            </div>

            <button onClick={onClose} disabled={saving}>
              ✕
            </button>
          </div>

          {/* BODY */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Monto a pagar</label>
                <input
                  type="number"
                  min={0.01}
                  max={p.balance}
                  step="0.01"
                  value={invoiceTotal.toFixed(2)}
                  disabled
                  className="mt-1 w-full border rounded px-3 py-2 text-sm bg-gray-100"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Saldo pendiente: ${round2(Number(p.balance ?? 0)).toFixed(2)}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Fecha de pago</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Cuenta bancaria</label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">-- Seleccione una cuenta --</option>
                {bankAccounts.map((b) => {
                  const disabled = !b.account_code?.trim();

                  return (
                    <option key={b.id} value={b.id} disabled={disabled}>
                    {b.name} ({b.account_code || "SIN CUENTA"}) {disabled ? "❌" : ""}
                  </option>
                  );
                })}

              </select>

              {selectedBank && (
                <div className="text-xs text-gray-500 mt-1">
                  Se debitará de: <strong>{selectedBank.name}</strong>
                </div>
              )}
            </div>

            

            <div className="border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold mb-2">
                Retenciones (opcional)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600 mb-3">
                <div className="border rounded p-3 bg-gray-50">
                  <div className="font-medium text-gray-700">
                    Base gasto para IR
                  </div>
                  <div>${expenseBase.toFixed(2)}</div>
                </div>

                <div className="border rounded p-3 bg-gray-50">
                  <div className="font-medium text-gray-700">
                    IVA factura para retención IVA
                  </div>
                  <div>${invoiceIVA.toFixed(2)}</div>
                </div>
              </div>

              {loadingBases && (
                <div className="text-xs text-blue-600 mb-3">
                  Cargando bases de retención desde el asiento original...
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={applyIR}
                      onChange={(e) => {
                        setApplyIR(e.target.checked);
                        if (!e.target.checked) setRetentionIR("");
                      }}
                    />
                    Aplicar retención IR
                  </label>

                  {applyIR && (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        {[1, 2, 8, 10].map((percent) => (
                          <button
                            key={percent}
                            type="button"
                            onClick={() => applyIRPreset(percent)}
                            disabled={expenseBase <= 0}
                            className="px-2 py-1 border rounded text-xs hover:bg-gray-100 disabled:opacity-50"
                          >
                            {percent}%
                          </button>
                        ))}
                      </div>

                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={retentionIR}
                        onChange={(e) => setRetentionIR(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                        placeholder="Valor retención IR"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={applyIVA}
                      onChange={(e) => {
                        setApplyIVA(e.target.checked);
                        if (!e.target.checked) setRetentionIVA("");
                      }}
                    />
                    Aplicar retención IVA
                  </label>

                  {applyIVA && (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        {[30, 70, 100].map((percent) => (
                          <button
                            key={percent}
                            type="button"
                            onClick={() => applyIVAPreset(percent)}
                            disabled={invoiceIVA <= 0}
                            className="px-2 py-1 border rounded text-xs hover:bg-gray-100 disabled:opacity-50"
                          >
                            {percent}%
                          </button>
                        ))}
                      </div>

                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={retentionIVA}
                        onChange={(e) => setRetentionIVA(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                        placeholder="Valor retención IVA"
                      />
                    </div>
                  )}
                </div>
              </div>

              {(applyIR || applyIVA) && (
                <div className="text-xs text-gray-700 mt-3 space-y-1">
                  <div>
                    Retención IR:{" "}
                    <strong>
                      ${(applyIR ? numericRetentionIR : 0).toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    Retención IVA:{" "}
                    <strong>
                      ${(applyIVA ? numericRetentionIVA : 0).toFixed(2)}
                    </strong>
                  </div>
                  <div className="text-xs text-gray-700 mt-3 space-y-1">
                    <div>
                      Factura (CxP): <strong>${invoiceTotal.toFixed(2)}</strong>
                    </div>

                    {applyIR && (
                      <div>
                        (-) Retención IR:{" "}
                        <strong>${numericRetentionIR.toFixed(2)}</strong>
                      </div>
                    )}

                    {applyIVA && (
                      <div>
                        (-) Retención IVA:{" "}
                        <strong>${numericRetentionIVA.toFixed(2)}</strong>
                      </div>
                    )}

                    <div className="border-t pt-1">
                      Pago por banco:{" "}
                      <strong>${bankPaymentAmount.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {exceedsInvoice && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
                Las retenciones no pueden exceder el saldo pendiente de la
                factura.
              </div>
            )}

            {belowInvoice && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded p-3">
                El total aplicado aún no cubre el saldo de la factura.
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
                {error}
              </div>
            )}

            {needsRepair && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-sm text-yellow-800 mb-2">
                  Esta factura fue creada sin cuenta contable.
                </p>

                <button
                  onClick={handleRepair}
                  disabled={repairing}
                  className="px-3 py-2 bg-yellow-600 text-white rounded text-sm"
                >
                  {repairing ? "Reparando..." : "🛠 Reparar cuenta contable"}
                </button>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded text-sm"
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-60"
              disabled={saving || loadingBases || exceedsInvoice}
            >
              {saving ? "Registrando..." : "Registrar pago"}
            </button>
          </div>
        </div>
      </Rnd>
    </div>
  );
}