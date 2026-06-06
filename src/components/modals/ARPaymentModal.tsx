// ============================================================================
// src/components/modals/ARPaymentModal.tsx
// CONTILISTO — Accounts Receivable: Registro de cobro con retenciones
//
// Supports:
//  • Manual entry of cash payment + retention amounts
//  • XML upload of customer-issued comprobante de retención (SRI electronic)
//  • Multiple IR retention lines (e.g. 2% bienes + 3% servicios)
//  • Stores tax.retenciones[] per line for ATS accuracy
// ============================================================================

import React, { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { v4 as uuidv4 } from "uuid";

import type { JournalEntry } from "@/types/JournalEntry";
import type { Receivable } from "@/types/Receivable";
import type { Account } from "@/types/AccountTypes";
import type { BankAccount } from "@/types/bankTypes";

import { saveJournalEntries } from "@/services/journalService";
import { applyReceivablePayment } from "@/services/receivablesService";
import { saveRetention } from "@/services/retentionsService";

import { parseSriRetXml } from "@/utils/parseSriRetXml";
import { SRI_IR_CODES, SRI_IVA_CODES } from "@/constants/sriRetentionCodes";

// ── helpers ──────────────────────────────────────────────────────────────────

const n2 = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

const fmt = (v?: number) => n2(v).toFixed(2);

const sanitize = (v: string) =>
  v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

function normInvoice(s: string) {
  return (s ?? "").replace(/[\s-]/g, "").replace(/^0+/, "").toLowerCase();
}

// ── types ────────────────────────────────────────────────────────────────────

interface IRLine {
  code: string;     // SRI retention code e.g. "312", "307"
  base: number;
  percentage: number;
  amount: number;
}

interface IVALine {
  code: string;     // SRI IVA retention code e.g. "10", "7"
  base: number;
  percentage: number;
  amount: number;
}

// ── props ────────────────────────────────────────────────────────────────────

interface Props {
  entityId: string;
  userId: string;
  receivable: Receivable;
  accounts: Account[];
  /** Bank accounts from COA — used to populate the bank dropdown */
  bankAccounts?: BankAccount[];
  onClose: () => void;
  onSuccess?: () => void;
}

// ── component ────────────────────────────────────────────────────────────────

export default function ARPaymentModal({
  entityId,
  userId,
  receivable,
  accounts,
  bankAccounts: bankAccountsProp,
  onClose,
  onSuccess,
}: Props) {

  // ── state ─────────────────────────────────────────────────────────────────

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [bankAccountId, setBankAccountId] = useState("");
  const [cashPayment, setCashPayment] = useState("");
  const [payFull, setPayFull] = useState(false);

  // Retention fields
  const [certificate, setCertificate] = useState("");
  const [certDate, setCertDate] = useState("");
  const [customerRUCRet, setCustomerRUCRet] = useState("");
  const [irLines, setIrLines] = useState<IRLine[]>([]);
  const [ivaLine, setIvaLine] = useState<IVALine | null>(null);
  const [hasRetention, setHasRetention] = useState(false);

  // XML upload
  const [xmlParsed, setXmlParsed] = useState(false);
  const [xmlWarning, setXmlWarning] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // UI
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Auto-select bank if only one — use prop list first, fall back to accounts filter
    const banks = bankAccountsProp && bankAccountsProp.length > 0
      ? bankAccountsProp
      : accounts
          .filter((a) => a.isBank || a.code?.startsWith("101010") || a.parentCode === "1010103")
          .map((a) => ({ id: a.code, entityId, name: a.name, code: a.code, account_code: a.code }));
    if (banks.length === 1) setBankAccountId(banks[0].code);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── derived ───────────────────────────────────────────────────────────────

  const balance = n2(receivable.balance ?? receivable.total ?? 0);

  const totalIR  = n2(irLines.reduce((s, l) => s + n2(l.amount), 0));
  const totalIVA = n2(ivaLine?.amount ?? 0);
  const totalRetentions = n2(totalIR + totalIVA);

  const cashNum = (() => {
    if (payFull) return Math.max(0, n2(balance - totalRetentions));
    return n2(cashPayment);
  })();

  const totalApplied = n2(cashNum + totalRetentions);
  const difference   = n2(balance - totalApplied);
  const isOver       = difference < -0.01;
  const isFull       = Math.abs(difference) < 0.01;

  // Use dedicated bank accounts prop when available (populated from COA),
  // otherwise fall back to filtering from general accounts list.
  const bankAccounts: Array<{ code: string; name: string }> =
    bankAccountsProp && bankAccountsProp.length > 0
      ? bankAccountsProp.map((b) => ({ code: b.account_code ?? b.code, name: b.name }))
      : accounts
          .filter((a) => a.isBank || a.code?.startsWith("101010") || a.parentCode === "1010103")
          .map((a) => ({ code: a.code, name: a.name }));

  const bank = bankAccounts.find((a) => a.code === bankAccountId);

  const arAccount = accounts.find((a) =>
    a.code?.replace(/\./g, "") === (receivable.account_code ?? "").replace(/\./g, "")
  );

  // Retention receivable accounts (standard Ecuador NEC codes)
  const irReceivableAccount  = accounts.find((a) => a.code?.replace(/\./g, "").startsWith("1130201"))
    ?? { code: "1130201", name: "Retención IR por recuperar" };
  const ivaReceivableAccount = accounts.find((a) => a.code?.replace(/\./g, "").startsWith("1130202"))
    ?? { code: "1130202", name: "Retención IVA por recuperar" };

  // ── XML upload ────────────────────────────────────────────────────────────

  async function handleXmlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setXmlWarning("");
    setError("");

    try {
      const text = await file.text();
      const parsed = parseSriRetXml(text);

      // Validate: check that cert applies to this invoice
      const certInvoices = [...new Set(
        parsed.retentions.map((r) => normInvoice(r.invoiceNumber))
      )];
      const myInvoice = normInvoice(receivable.invoiceNumber ?? "");

      const matches = certInvoices.some((ci) => ci.includes(myInvoice) || myInvoice.includes(ci));

      if (!matches && myInvoice) {
        setXmlWarning(
          `El comprobante aplica a la factura ${parsed.retentions[0]?.invoiceNumber ?? "?"}, ` +
          `pero esta cuenta es de la factura ${receivable.invoiceNumber}. Verifique antes de guardar.`
        );
      }

      // Fill certificate fields
      setCertificate(parsed.certNumber ?? "");
      setCertDate(parsed.issueDate ?? parsed.authDate ?? date);
      setCustomerRUCRet(parsed.issuerRUC ?? "");
      setDate(parsed.issueDate || parsed.authDate || date);

      // Fill IR lines (taxCode "1" = IR)
      const rentaLines = parsed.retentions.filter((r) => r.taxCode === "1");
      setIrLines(
        rentaLines.map((r) => ({
          code: r.retentionCode,
          base: n2(r.baseAmount),
          percentage: n2(r.percentage),
          amount: n2(r.retainedAmount),
        }))
      );

      // Fill IVA line (taxCode "2" = IVA)
      const ivaLines = parsed.retentions.filter((r) => r.taxCode === "2");
      if (ivaLines.length > 0) {
        const totalIvaBase = n2(ivaLines.reduce((s, l) => s + n2(l.baseAmount), 0));
        const totalIvaAmt  = n2(ivaLines.reduce((s, l) => s + n2(l.retainedAmount), 0));
        const avgPct = totalIvaBase > 0 ? n2((totalIvaAmt / totalIvaBase) * 100) : n2(ivaLines[0]?.percentage ?? 100);
        setIvaLine({
          code: ivaLines[0].retentionCode,
          base: totalIvaBase,
          percentage: avgPct,
          amount: totalIvaAmt,
        });
      } else {
        setIvaLine(null);
      }

      setHasRetention(rentaLines.length > 0 || ivaLines.length > 0);
      setXmlParsed(true);
      setPayFull(true); // assume full settlement

    } catch (err: any) {
      setError("Error al leer el XML: " + (err?.message ?? "Formato no reconocido"));
    }

    // Clear file input so same file can be re-uploaded
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── IR line helpers ───────────────────────────────────────────────────────

  function addIRLine() {
    setIrLines((prev) => [...prev, { code: "312", base: 0, percentage: 1, amount: 0 }]);
  }

  function removeIRLine(idx: number) {
    setIrLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateIRLine(idx: number, field: keyof IRLine, val: string) {
    setIrLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const next = { ...l };
        if (field === "code") {
          next.code = val;
        } else {
          (next as any)[field] = n2(val);
          // Auto-compute amount from base × %
          if (field === "base" || field === "percentage") {
            const b = field === "base" ? n2(val) : next.base;
            const p = field === "percentage" ? n2(val) : next.percentage;
            next.amount = n2((b * p) / 100);
          }
          // Auto-compute base from amount / %
          if (field === "amount" && next.percentage > 0) {
            next.base = n2((n2(val) / next.percentage) * 100);
          }
        }
        return next;
      })
    );
  }

  // ── save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setError("");

    if (totalApplied <= 0)      return setError("El valor aplicado debe ser mayor que cero.");
    if (isOver)                 return setError("El valor aplicado excede el saldo pendiente.");
    if (!bank && cashNum > 0)   return setError("Seleccione una cuenta bancaria para el pago en efectivo.");
    if (!arAccount)             return setError("Cuenta de clientes no encontrada en el Plan de Cuentas.");
    if (!hasRetention && cashNum === 0)
                                return setError("Ingrese un monto de pago bancario o active las retenciones.");
    if (hasRetention && !certificate.trim())
                                return setError("Ingrese el número del comprobante de retención.");

    try {
      setSaving(true);

      const tx = uuidv4();
      const entries: JournalEntry[] = [];

      const base: Omit<JournalEntry, "account_code" | "account_name" | "debit" | "credit" | "description"> = {
        entityId,
        uid: userId,
        transactionId: tx,
        date,
        transactionType: "payment",
        documentNature: "sale",
        invoice_number: receivable.invoiceNumber,
        customer_ruc:   receivable.customerRUC,
        customer_name:  receivable.customerName,
      };

      // ── 1. Bank debit (cash received) ───────────────────────────────────
      if (cashNum > 0 && bank) {
        entries.push({
          ...base,
          account_code: bank.code,
          account_name: bank.name,
          debit:  cashNum,
          credit: 0,
          description: `Cobro fact. ${receivable.invoiceNumber}${certificate ? ` — Ret. ${certificate}` : ""}`,
        });
      }

      // ── 2. IR retention debits (one per line) ────────────────────────────
      if (totalIR > 0) {
        entries.push({
          ...base,
          account_code: irReceivableAccount.code,
          account_name: irReceivableAccount.name,
          debit:  totalIR,
          credit: 0,
          description: `Ret. IR ${certificate} — fact. ${receivable.invoiceNumber}`,
          tax: {
            retenciones: irLines.map((l) => ({
              taxType: "RENTA" as const,
              code:       l.code,
              percentage: l.percentage,
              base:       l.base,
              amount:     l.amount,
            })),
          },
        });
      }

      // ── 3. IVA retention debit ───────────────────────────────────────────
      if (totalIVA > 0 && ivaLine) {
        entries.push({
          ...base,
          account_code: ivaReceivableAccount.code,
          account_name: ivaReceivableAccount.name,
          debit:  totalIVA,
          credit: 0,
          description: `Ret. IVA ${certificate} — fact. ${receivable.invoiceNumber}`,
          tax: {
            retenciones: [{
              taxType: "IVA" as const,
              code:       ivaLine.code,
              percentage: ivaLine.percentage,
              base:       ivaLine.base,
              amount:     ivaLine.amount,
            }],
          },
        });
      }

      // ── 4. AR credit (cancels the receivable) ────────────────────────────
      entries.push({
        ...base,
        account_code: arAccount.code,
        account_name: arAccount.name,
        debit:  0,
        credit: totalApplied,
        description: `Cancelación fact. ${receivable.invoiceNumber}${certificate ? ` — Ret. ${certificate}` : ""}`,
      });

      // ── Balance check ────────────────────────────────────────────────────
      const sumD = n2(entries.reduce((s, e) => s + n2(e.debit), 0));
      const sumC = n2(entries.reduce((s, e) => s + n2(e.credit), 0));
      if (Math.abs(sumD - sumC) > 0.01) {
        throw new Error(`Asiento no balanceado: DR ${fmt(sumD)} ≠ CR ${fmt(sumC)}`);
      }

      // ── Persist ──────────────────────────────────────────────────────────
      await saveJournalEntries(entityId, userId, entries);

      await applyReceivablePayment(entityId, receivable, totalApplied, userId, tx);

      if (hasRetention) {
        await saveRetention(entityId, {
          type: "received",
          certNumber:   certificate,
          certDate:     certDate || date,
          issuerRUC:    customerRUCRet || receivable.customerRUC,
          issuerName:   receivable.customerName,
          subjectRUC:   entityId,
          invoiceNumber: receivable.invoiceNumber,
          irLines,
          ivaLine,
          totalIR,
          totalIVA,
          transactionId: tx,
          createdAt: new Date().toISOString(),
        });
      }

      onSuccess?.();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Error al registrar el cobro");
    } finally {
      setSaving(false);
    }
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Rnd
        default={{
          x: Math.max(12, window.innerWidth / 2 - 370),
          y: 28,
          width: 740,
          height: "auto",
        }}
        enableResizing={false}
        dragHandleClassName="drag-header"
        dragCancel="input, textarea, select, button, label"
        bounds="window"
      >
        <div className="w-full rounded-xl bg-white shadow-xl flex flex-col" style={{ maxHeight: "92vh" }}>

          {/* HEADER */}
          <div className="drag-header cursor-move active:cursor-grabbing flex items-start justify-between border-b px-6 py-3 select-none">
            <div>
              <h2 className="text-base font-bold">Registrar cobro</h2>
              <p className="text-xs text-gray-500">
                {receivable.customerName ?? "Cliente"} • Factura {receivable.invoiceNumber}
              </p>
            </div>
            <button onClick={onClose} disabled={saving} className="text-gray-400 hover:text-gray-600 text-lg leading-none mt-0.5">✕</button>
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto space-y-4 p-5">

            {/* SUMMARY CARD */}
            <div className="grid grid-cols-4 gap-2 rounded-lg border bg-gray-50 p-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Monto factura</p>
                <p className="font-semibold">${fmt(receivable.total)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Saldo pendiente</p>
                <p className="font-bold text-green-700">${fmt(balance)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">RUC cliente</p>
                <p className="font-medium text-xs">{receivable.customerRUC || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Fecha emisión</p>
                <p className="font-medium text-xs">{receivable.issueDate || "—"}</p>
              </div>
            </div>

            {/* RETENTION XML UPLOAD */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-800">
                    📎 Comprobante de Retención (XML)
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Cargue el XML electrónico emitido por el cliente para autocompletar las retenciones.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="shrink-0 ml-4 rounded-lg border border-blue-500 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  Cargar XML
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xml,text/xml,application/xml"
                className="hidden"
                onChange={handleXmlUpload}
              />
              {xmlParsed && (
                <p className="mt-2 text-xs text-green-700 font-medium">
                  ✅ XML cargado — datos completados automáticamente.
                </p>
              )}
              {xmlWarning && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded p-2">
                  ⚠️ {xmlWarning}
                </p>
              )}
            </div>

            {/* PAYMENT MODE SHORTCUT */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setPayFull(true); setHasRetention(false); setIrLines([]); setIvaLine(null); }}
                className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                  !hasRetention && payFull
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                💰 Solo pago en banco
              </button>
              <button
                type="button"
                onClick={() => { setCashPayment("0"); setPayFull(false); setHasRetention(true); }}
                className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                  hasRetention && cashNum === 0 && !payFull
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                📄 Solo retención (sin cobro bancario)
              </button>
              <button
                type="button"
                onClick={() => { setPayFull(true); setHasRetention(true); }}
                className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                  hasRetention && payFull
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                ✅ Banco + retención
              </button>
            </div>

            {/* PAYMENT FIELDS */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Fecha de cobro</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Cuenta bancaria
                  {cashNum === 0 && <span className="ml-1 text-xs text-gray-400 font-normal">(no requerida)</span>}
                </label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  disabled={cashNum === 0}
                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">— Seleccionar —</option>
                  {bankAccounts.map((b) => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </select>
                {cashNum === 0 && (
                  <p className="mt-0.5 text-xs text-amber-600">
                    Pago solo por retención — no hay transferencia bancaria.
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">Pago bancario</label>
                  <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={payFull}
                      onChange={(e) => setPayFull(e.target.checked)}
                      className="accent-blue-600"
                    />
                    Saldo completo
                  </label>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={payFull ? cashNum.toFixed(2) : cashPayment}
                  disabled={payFull}
                  onChange={(e) => setCashPayment(sanitize(e.target.value))}
                  placeholder="0.00"
                  className="w-full rounded border px-2 py-1.5 text-sm font-mono disabled:bg-gray-100"
                />
                {payFull && cashNum > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">Calculado: saldo − retenciones</p>
                )}
                {cashNum === 0 && !payFull && cashPayment === "0" && (
                  <p className="text-xs text-amber-600 mt-0.5">$0.00 — cobro únicamente por retención</p>
                )}
              </div>
            </div>

            {/* RETENTION SECTION */}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={hasRetention}
                    onChange={(e) => {
                      setHasRetention(e.target.checked);
                      if (!e.target.checked) {
                        setIrLines([]);
                        setIvaLine(null);
                        setCertificate("");
                        setCertDate("");
                      }
                    }}
                    className="accent-blue-600"
                  />
                  Aplicar retenciones del cliente
                </label>
              </div>

              {hasRetention && (
                <div className="space-y-3">

                  {/* Certificate number */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-600 font-medium">
                        N° Comprobante de Retención *
                      </label>
                      <input
                        type="text"
                        value={certificate}
                        onChange={(e) => setCertificate(e.target.value)}
                        placeholder="001-010-000000001"
                        className="mt-1 w-full rounded border px-2 py-1.5 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 font-medium">
                        Fecha del comprobante
                      </label>
                      <input
                        type="date"
                        value={certDate || date}
                        onChange={(e) => setCertDate(e.target.value)}
                        className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>

                  {/* IR Retention lines */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Retenciones IR (Impuesto a la Renta)
                      </span>
                      <button
                        type="button"
                        onClick={addIRLine}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        + Agregar línea
                      </button>
                    </div>

                    {irLines.length === 0 && (
                      <p className="text-xs text-gray-400 italic py-1">
                        Sin retenciones IR. Haga clic en "+ Agregar línea" o cargue el XML.
                      </p>
                    )}

                    {irLines.map((line, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end mb-2">
                        {/* Code */}
                        <div className="col-span-4">
                          {idx === 0 && <label className="text-xs text-gray-500">Código SRI</label>}
                          <select
                            value={line.code}
                            onChange={(e) => updateIRLine(idx, "code", e.target.value)}
                            className="mt-1 w-full rounded border px-1.5 py-1 text-xs"
                          >
                            <option value="">— Código —</option>
                            {SRI_IR_CODES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code} – {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {/* Base */}
                        <div className="col-span-3">
                          {idx === 0 && <label className="text-xs text-gray-500">Base imponible</label>}
                          <input
                            type="text"
                            inputMode="decimal"
                            value={line.base > 0 ? line.base : ""}
                            onChange={(e) => updateIRLine(idx, "base", sanitize(e.target.value))}
                            placeholder="0.00"
                            className="mt-1 w-full rounded border px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        {/* % */}
                        <div className="col-span-2">
                          {idx === 0 && <label className="text-xs text-gray-500">%</label>}
                          <input
                            type="text"
                            inputMode="decimal"
                            value={line.percentage > 0 ? line.percentage : ""}
                            onChange={(e) => updateIRLine(idx, "percentage", sanitize(e.target.value))}
                            placeholder="%"
                            className="mt-1 w-full rounded border px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        {/* Amount */}
                        <div className="col-span-2">
                          {idx === 0 && <label className="text-xs text-gray-500">Valor ret.</label>}
                          <input
                            type="text"
                            inputMode="decimal"
                            value={line.amount > 0 ? line.amount : ""}
                            onChange={(e) => updateIRLine(idx, "amount", sanitize(e.target.value))}
                            placeholder="0.00"
                            className="mt-1 w-full rounded border px-2 py-1 text-xs font-mono bg-gray-50"
                          />
                        </div>
                        {/* Remove */}
                        <div className="col-span-1 flex justify-center">
                          <button
                            type="button"
                            onClick={() => removeIRLine(idx)}
                            className="text-red-400 hover:text-red-600 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}

                    {irLines.length > 0 && (
                      <div className="text-right text-xs font-semibold text-gray-700 mt-1">
                        Total IR: <span className="font-mono">${fmt(totalIR)}</span>
                      </div>
                    )}
                  </div>

                  {/* IVA Retention */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Retención IVA
                      </span>
                      {!ivaLine && (
                        <button
                          type="button"
                          onClick={() => setIvaLine({ code: "10", base: 0, percentage: 100, amount: 0 })}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          + Agregar
                        </button>
                      )}
                    </div>

                    {!ivaLine && (
                      <p className="text-xs text-gray-400 italic py-1">
                        Sin retención IVA.
                      </p>
                    )}

                    {ivaLine && (
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-4">
                          <label className="text-xs text-gray-500">Código SRI</label>
                          <select
                            value={ivaLine.code}
                            onChange={(e) => setIvaLine((prev) => prev ? { ...prev, code: e.target.value } : prev)}
                            className="mt-1 w-full rounded border px-1.5 py-1 text-xs"
                          >
                            {SRI_IVA_CODES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code} – {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-3">
                          <label className="text-xs text-gray-500">Base (IVA)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={ivaLine.base > 0 ? ivaLine.base : ""}
                            onChange={(e) => {
                              const b = n2(sanitize(e.target.value));
                              setIvaLine((prev) => prev ? {
                                ...prev, base: b,
                                amount: n2((b * prev.percentage) / 100)
                              } : prev);
                            }}
                            placeholder="0.00"
                            className="mt-1 w-full rounded border px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500">%</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={ivaLine.percentage > 0 ? ivaLine.percentage : ""}
                            onChange={(e) => {
                              const p = n2(sanitize(e.target.value));
                              setIvaLine((prev) => prev ? {
                                ...prev, percentage: p,
                                amount: n2((prev.base * p) / 100)
                              } : prev);
                            }}
                            placeholder="%"
                            className="mt-1 w-full rounded border px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500">Valor ret.</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={ivaLine.amount > 0 ? ivaLine.amount : ""}
                            onChange={(e) =>
                              setIvaLine((prev) => prev ? { ...prev, amount: n2(sanitize(e.target.value)) } : prev)
                            }
                            placeholder="0.00"
                            className="mt-1 w-full rounded border px-2 py-1 text-xs font-mono bg-gray-50"
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button
                            type="button"
                            onClick={() => setIvaLine(null)}
                            className="text-red-400 hover:text-red-600 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* JOURNAL PREVIEW */}
            <div className="rounded-lg border bg-gray-50 p-3 text-xs">
              <p className="font-semibold text-gray-700 mb-2 text-sm">Resumen del asiento</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="text-left py-1 font-medium">Cuenta</th>
                    <th className="text-right py-1 font-medium w-24">Débito</th>
                    <th className="text-right py-1 font-medium w-24">Crédito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cashNum > 0 && bank && (
                    <tr>
                      <td className="py-1">{bank.name}</td>
                      <td className="text-right font-mono">${fmt(cashNum)}</td>
                      <td className="text-right font-mono text-gray-300">—</td>
                    </tr>
                  )}
                  {totalIR > 0 && (
                    <tr>
                      <td className="py-1">{irReceivableAccount.name}</td>
                      <td className="text-right font-mono">${fmt(totalIR)}</td>
                      <td className="text-right font-mono text-gray-300">—</td>
                    </tr>
                  )}
                  {totalIVA > 0 && (
                    <tr>
                      <td className="py-1">{ivaReceivableAccount.name}</td>
                      <td className="text-right font-mono">${fmt(totalIVA)}</td>
                      <td className="text-right font-mono text-gray-300">—</td>
                    </tr>
                  )}
                  {totalApplied > 0 && arAccount && (
                    <tr>
                      <td className="py-1">{arAccount.name}</td>
                      <td className="text-right font-mono text-gray-300">—</td>
                      <td className="text-right font-mono">${fmt(totalApplied)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Balance indicator */}
              <div className="mt-2 pt-2 border-t flex justify-between items-center">
                <span className="text-gray-500">
                  {isFull
                    ? "✅ Pago completo"
                    : difference > 0
                    ? `Saldo restante: $${fmt(difference)}`
                    : ""}
                </span>
                <span className={`font-semibold ${isOver ? "text-red-600" : "text-gray-700"}`}>
                  Total aplicado: ${fmt(totalApplied)}
                </span>
              </div>
            </div>

            {/* ERROR */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

          </div>

          {/* FOOTER */}
          <div className="flex justify-end gap-3 border-t px-6 py-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || totalApplied <= 0 || isOver}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Registrar cobro"}
            </button>
          </div>

        </div>
      </Rnd>
    </div>
  );
}
