// ============================================================================
// src/components/modals/RegisterPayablePaymentModal.tsx
// CONTILISTO — Accounts Payable Payment Modal
// IMPROVED:
// - Partial payments
// - AR-style calculation flow
// - Ecuador retention presets
// - Certificate required when retentions exist
// - Journal-first flow (bank movement should be auto-created from journal)
// - Correct payable balance update via applyPayablePayment()
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { Rnd } from "react-rnd";

import type { Payable } from "@/types/Payable";
import type { JournalEntry } from "@/types/JournalEntry";
import type { BankAccount } from "@/types/bankTypes";

import {
  createPayablePaymentJournalEntry,
  fetchJournalEntriesByTransactionId,
} from "@/services/journalService";

import {
  applyPayablePayment,
  repairPayableAccountFromJournal,
} from "@/services/payablesService";

import { normalizeAccountCode } from "@/utils/normalizeAccountCode";

/* -------------------------------------------------------------------------- */
/* Props                                                                      */
/* -------------------------------------------------------------------------- */

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
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function safeMoney(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function round2(v: number): number {
  return Number(Number(v || 0).toFixed(2));
}

function sanitizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
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
      (code === "1330101" ||
        code === "133010101" ||
        code === "133010102" ||
        code.startsWith("133"))
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
/* Component                                                                  */
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

  const [paymentAmount, setPaymentAmount] = useState("");
  const [applyIR, setApplyIR] = useState(false);
  const [applyIVA, setApplyIVA] = useState(false);
  const [retentionIR, setRetentionIR] = useState("");
  const [retentionIVA, setRetentionIVA] = useState("");
  const [certificate, setCertificate] = useState("");

  const [saving, setSaving] = useState(false);
  const [loadingBases, setLoadingBases] = useState(false);
  const [error, setError] = useState("");

  const [needsRepair, setNeedsRepair] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const [expenseBase, setExpenseBase] = useState(0);
  const [invoiceIVA, setInvoiceIVA] = useState(0);

  const [modalPosition, setModalPosition] = useState({
    x: 0,
    y: 0,
  });

  const [payFull, setPayFull] = useState(false);

  /* ------------------------------------------------------------------------ */
  /* Init                                                                     */
  /* ------------------------------------------------------------------------ */

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
    if (bankAccounts.length === 1) {
      setBankAccountId(bankAccounts[0].id);
    };

    setPaymentAmount("");
    setApplyIR(false);
    setApplyIVA(false);
    setRetentionIR("");
    setRetentionIVA("");
    setCertificate("");

    setError("");
    setNeedsRepair(false);
    setExpenseBase(0);
    setInvoiceIVA(0);
  }, [isOpen, payable, bankAccounts]);

  /* ------------------------------------------------------------------------ */
  /* Load invoice bases from original journal                                 */
  /* ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------ */
  /* Derived values                                                           */
  /* ------------------------------------------------------------------------ */

  const currentPayable = localPayable ?? payable;

  const selectedBank = useMemo(
    () => bankAccounts.find((b) => b.id === bankAccountId),
    [bankAccounts, bankAccountId]
  );

  const invoiceBalance = useMemo(() => {
    return round2(Number(currentPayable?.balance ?? 0));
  }, [currentPayable?.balance]);

  const invoiceTotal = round2(Number(currentPayable?.total ?? 0));

  const paymentAmountNum = useMemo(
    () => safeMoney(paymentAmount),
    [paymentAmount]
  );

  const numericRetentionIR = useMemo(
    () => safeMoney(retentionIR),
    [retentionIR]
  );

  const numericRetentionIVA = useMemo(
    () => safeMoney(retentionIVA),
    [retentionIVA]
  );

  const totalApplied = useMemo(() => {
    return round2(
      paymentAmountNum +
        (applyIR ? numericRetentionIR : 0) +
        (applyIVA ? numericRetentionIVA : 0)
    );
  }, [
    paymentAmountNum,
    applyIR,
    applyIVA,
    numericRetentionIR,
    numericRetentionIVA,
  ]);

  const difference = useMemo(() => {
    return round2(invoiceBalance - totalApplied);
  }, [invoiceBalance, totalApplied]);

  const isOverApplied = difference < -0.009;
  const isPartial = totalApplied > 0 && totalApplied < invoiceBalance - 0.009;
  const isFull = Math.abs(difference) < 0.01;

  useEffect(() => {
        if (payFull) {
          setPaymentAmount(invoiceBalance.toFixed(2));
        }
      }, [payFull, invoiceBalance]);

  /* ------------------------------------------------------------------------ */
  /* Guard after hooks                                                        */
  /* ------------------------------------------------------------------------ */

  if (!isOpen || !currentPayable) return null;

  const p = currentPayable;

  /* ------------------------------------------------------------------------ */
  /* Retention preset handlers                                                */
  /* ------------------------------------------------------------------------ */

  function applyIRPreset(percent: number) {
    const value = calcRetentionFromPercent(expenseBase, percent);
    setRetentionIR(value.toFixed(2));
  }

  function applyIVAPreset(percent: number) {
    const value = calcRetentionFromPercent(invoiceIVA, percent);
    setRetentionIVA(value.toFixed(2));
  }

  console.log("Selected Bank FULL:", selectedBank);

  /* ------------------------------------------------------------------------ */
  /* Save payment                                                             */
  /* ------------------------------------------------------------------------ */

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

      if (invoiceBalance <= 0) {
        throw new Error("La factura no tiene saldo pendiente.");
      }

      if (paymentAmountNum < 0) {
        throw new Error("El pago por banco no puede ser negativo.");
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

      if (totalApplied <= 0) {
        throw new Error("El valor aplicado debe ser mayor que cero.");
      }

      if (isOverApplied) {
        throw new Error("El valor aplicado excede el saldo pendiente de la factura.");
      }

      if ((applyIR || applyIVA) && !certificate.trim()) {
        throw new Error("Debe ingresar el certificado de retención.");
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
        (e) =>
          String(e.invoice_number ?? "").trim() ===
          String(p.invoiceNumber ?? "").trim()
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

      if (!selectedBank.id) {
        throw new Error("La cuenta bancaria no tiene ID válido.");
      }

      const bankGL = String(
        selectedBank.account_code ??
        (selectedBank as any).code ??
        ""
      ).trim();

      if (!bankGL) {
        throw new Error(
          `La cuenta bancaria "${selectedBank.name}" no tiene cuenta contable asignada.`
        );
      }

      const payableForSave: Payable = {
        ...p,
        entityId: p.entityId ?? entityId,
        account_code: payableAccountCode,
        account_name: payableAccountName,
      };

      await createPayablePaymentJournalEntry(
        entityId,
        payableForSave,
        paymentAmountNum,
        paymentDate,
        {
          id: selectedBank.id,
          account_code: bankGL,
          name: selectedBank.name ?? "Cuenta bancaria",
        },
        userIdSafe,
        {
          retentionIR: applyIR ? numericRetentionIR : 0,
          retentionIVA: applyIVA ? numericRetentionIVA : 0,
        },
        
      );

      await applyPayablePayment(entityId, payableForSave, totalApplied);

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

  /* ------------------------------------------------------------------------ */
  /* Repair payable                                                           */
  /* ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------ */
  /* UI                                                                       */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      
      <Rnd
        default={{
          x: Math.max(12, window.innerWidth / 2 - 320),
          y: 24,
          width: 820,
          height: 600,
        }}
        onDragStop={(_, d) => {
          setModalPosition({ x: d.x, y: d.y });
        }}
        position={modalPosition}
        enableResizing={false}
        dragHandleClassName="drag-header"
        dragCancel="input, textarea, select, button"
        bounds="window"
      >
        <div className="w-full rounded-xl bg-white shadow-xl">
          {/* HEADER */}
          
          <div className="drag-header flex cursor-move active:cursor-grabbing justify-between border-b px-6 py-3 select-none">
            
            <div>
              <h2 className="text-base font-bold">Registrar pago</h2>
              <p className="text-xs text-gray-500">
                {p.supplierName ?? "Proveedor"} • Factura {p.invoiceNumber}
              </p>
            </div>

            <button onClick={onClose} disabled={saving}>
              ✕
            </button>
          </div>

          {/* BODY */}
          <div className="space-y-3 p-4">
            {/* SUMMARY */}
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-2 rounded-lg border bg-gray-50 p-3 text-sm">
              <div>
                <div className="text-xs font-medium text-gray-500">
                  Monto factura
                </div>
                <div className="text-base font-semibold text-gray-900">
                  ${invoiceTotal.toFixed(2)}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-gray-500">
                  Base gasto
                </div>
                <div className="text-base font-semibold text-gray-900">
                  ${expenseBase.toFixed(2)}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-gray-500">
                  IVA factura
                </div>
                <div className="text-base font-semibold text-gray-900">
                  ${invoiceIVA.toFixed(2)}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-gray-500">
                  Saldo pendiente
                </div>
                <div className="text-base font-bold text-gray-900">
                  ${invoiceBalance.toFixed(2)}
                </div>
              </div>
            </div>

            {loadingBases && (
              <div className="rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
                Cargando bases de retención desde el asiento original...
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Fecha de pago</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Cuenta bancaria</label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="">-- Seleccione una cuenta --</option>
                  {bankAccounts.map((b) => {
                    const disabled = !b.account_code?.trim();

                    return (
                      <option key={b.id} value={b.id} disabled={disabled}>
                        {b.name} ({b.account_code || "SIN CUENTA"}){" "}
                        {disabled ? "❌" : ""}
                      </option>
                    );
                  })}
                </select>

                {selectedBank && (
                  <div className="mt-1 text-xs text-gray-500">
                    Se acreditará banco desde: <strong>{selectedBank.name}</strong>
                  </div>
                )}
              </div>

              <div className="col-span-1 md:col-span-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">Pago por banco</label>
                </div>
                  
                <input
                  type="text"
                  inputMode="decimal"
                  value={paymentAmount}
                  disabled={payFull}
                  onChange={(e) =>
                    setPaymentAmount(sanitizeDecimalInput(e.target.value))
                  }
                  placeholder="0.00"
                  className="w-full rounded border px-2 py-1.5 text-sm disabled:bg-gray-100"
                />
              </div>
              
            </div>

            {/* RETENTIONS */}
            <div className="mt-2 border-t pt-2">
              <h3 className="mb-2 text-sm font-semibold">Retenciones (opcional)</h3>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {/* IR */}
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
                      <div className="flex flex-wrap gap-2">
                        {[1, 1.75, 2, 3, 5, 10].map((percent) => (
                          <button
                            key={percent}
                            type="button"
                            onClick={() => applyIRPreset(percent)}
                            disabled={expenseBase <= 0}
                            className="rounded border px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50"
                          >
                            {percent}%
                          </button>
                        ))}
                      </div>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={retentionIR}
                        onChange={(e) =>
                          setRetentionIR(sanitizeDecimalInput(e.target.value))
                        }
                        placeholder="Valor retención IR"
                        className="w-full rounded border px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* IVA */}
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
                      <div className="flex flex-wrap gap-2">
                        {[30, 70, 100].map((percent) => (
                          <button
                            key={percent}
                            type="button"
                            onClick={() => applyIVAPreset(percent)}
                            disabled={invoiceIVA <= 0}
                            className="rounded border px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50"
                          >
                            {percent}%
                          </button>
                        ))}
                      </div>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={retentionIVA}
                        onChange={(e) =>
                          setRetentionIVA(sanitizeDecimalInput(e.target.value))
                        }
                        placeholder="Valor retención IVA"
                        className="w-full rounded border px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>

              {(applyIR || applyIVA) && (
                <div className="mt-4">
                  <label className="text-sm font-medium">
                    Certificado de Retención
                  </label>
                  <input
                    value={certificate}
                    onChange={(e) => setCertificate(e.target.value)}
                    placeholder="Ingrese número del certificado"
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>

            {/* SUMMARY PANEL */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Pago banco</span>
                <b className="text-gray-900">${paymentAmountNum.toFixed(2)}</b>
              </div>

              <div className="mt-1 flex items-center justify-between">
                <span className="text-gray-600">Retención IR</span>
                <b className="text-gray-900">
                  ${(applyIR ? numericRetentionIR : 0).toFixed(2)}
                </b>
              </div>

              <div className="mt-1 flex items-center justify-between">
                <span className="text-gray-600">Retención IVA</span>
                <b className="text-gray-900">
                  ${(applyIVA ? numericRetentionIVA : 0).toFixed(2)}
                </b>
              </div>

              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <span className="text-gray-600">Total aplicado</span>
                <b className="text-gray-900">${totalApplied.toFixed(2)}</b>
              </div>

              <div className="mt-1 flex items-center justify-between">
                <span className="text-gray-600">Diferencia</span>
                <span
                  className={
                    isOverApplied
                      ? "font-semibold text-red-600"
                      : "font-semibold text-gray-900"
                  }
                >
                  ${difference.toFixed(2)}
                </span>
              </div>

              <div className="mt-1 flex items-center justify-between">
                <span className="text-gray-600">Saldo restante</span>
                <span className="font-semibold text-gray-900">
                  ${Math.max(difference, 0).toFixed(2)}
                </span>
              </div>

              {isPartial && (
                <div className="mt-2 text-xs text-amber-700">
                  Este pago es parcial. La factura quedará con saldo pendiente.
                </div>
              )}

              {isFull && (
                <div className="mt-2 text-xs text-green-700">
                  Este pago liquida completamente la factura.
                </div>
              )}

              {isOverApplied && (
                <div className="mt-2 text-xs text-red-700">
                  El valor aplicado excede el saldo pendiente de la factura.
                </div>
              )}
            </div>

            {/* ERRORS */}
            {error && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* REPAIR */}
            {needsRepair && (
              <div className="rounded border border-yellow-200 bg-yellow-50 p-3">
                <p className="mb-2 text-sm text-yellow-800">
                  Esta factura fue creada sin cuenta contable.
                </p>

                <button
                  onClick={handleRepair}
                  disabled={repairing}
                  className="rounded bg-yellow-600 px-3 py-2 text-sm text-white"
                >
                  {repairing ? "Reparando..." : "🛠 Reparar cuenta contable"}
                </button>
              </div>
            )}
          </div>

          {/* FULL PAYMENT TOGGLE */}
          <div className="flex justify-center mt-2">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={payFull}
                onChange={(e) => setPayFull(e.target.checked)}
              />
              Pagar saldo total
            </label>
          </div>

          {/* FOOTER */}
          <div className="flex justify-end gap-2 border-t px-6 py-4">
            <button
              onClick={onClose}
              className="rounded border px-4 py-2 text-sm"
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
              disabled={saving || loadingBases || totalApplied <= 0 || isOverApplied}
            >
              {saving ? "Registrando..." : "Registrar pago"}
            </button>
          </div>
        </div>
      </Rnd>
    </div>
  );
}