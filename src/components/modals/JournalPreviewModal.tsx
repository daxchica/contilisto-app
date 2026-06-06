// ============================================================================
// src/components/JournalPreviewModal.tsx
// CONTILISTO — STABLE PRODUCTION VERSION (IMPROVED)
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { getAuth } from "firebase/auth";

import type { Account } from "@/types/AccountTypes";
import type { JournalEntry } from "@/types/JournalEntry";
import type { InvoicePreviewMetadata } from "@/types/InvoicePreviewMetadata";

import AccountPicker from "@/components/AccountPicker";
import { saveContextualAccountHint } from "@/services/firestoreHintsService";
import { validateJournalStructure } from "@/utils/validators/validateJournalStructure";

import {
  isCustomerReceivableAccount,
  isSupplierPayableAccount,
} from "@/services/controlAccounts";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  entries: JournalEntry[];
  metadata: InvoicePreviewMetadata;

  accounts: Account[];
  postableAccounts: Account[];
  leafCodeSet: Set<string>;

  entityId: string;
  userIdSafe: string;

  onClose: () => void;
  onSave: (entries: JournalEntry[], note: string) => Promise<void>;

  // Queue navigation (SRI TXT batch mode)
  queuePosition?: { current: number; total: number };
  confirmedCount?: number;   // how many have already been saved in this session
  onSkip?: () => void;
}

type Row = Omit<JournalEntry, "debit" | "credit"> & {
  debit: number;
  credit: number;
  _debitRaw?: string;
  _creditRaw?: string;
  _isEdited?: boolean;
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const todayISO = () => new Date().toISOString().slice(0, 10);

const toISODate = (raw?: string) => {
  if (!raw) return todayISO();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [_, d, mth, y] = m;
    return `${y}-${mth}-${d}`;
  }

  return todayISO();
};

const formatMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

const parseMoney = (raw: string) => {
  const cleaned = raw.replace(/[^\d.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
};

const normalizeCode = (c?: string) =>
  (c || "").replace(/\./g, "").trim();


const createEmptyRow = (
  entityId: string,
  uid: string,
  transactionId: string,
  date: string,
  invoice?: string
): Row => ({
  id: crypto.randomUUID(),
  
  entityId,
  uid,

  transactionId,

  transactionType: "invoice",
  documentNature: "sale",

  date,
  account_code: "",
  account_name: "",
  
  debit: 0,
  credit: 0,

  description: "",
  invoice_number: invoice ?? "",
  source: "edited",
  createdAt: Date.now(),
});

const areAllRowsPostable = (rows: Row[], postableAccounts: Account[]) => {
  const set = new Set(
    postableAccounts.map(a => normalizeCode(a.code))
  );

  return rows
    .filter(r => r.account_code || r.debit || r.credit)
    .every(r => set.has(normalizeCode(r.account_code)));
};

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------

export default function JournalPreviewModal({
  open,
  entries,
  metadata,
  accounts,
  postableAccounts,
  leafCodeSet,
  entityId,
  userIdSafe,
  onClose,
  onSave,
  queuePosition,
  confirmedCount = 0,
  onSkip,
}: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isPersonalExpense, setIsPersonalExpense] = useState(false);
  const [personalCategory, setPersonalCategory] = useState("Otros");

  // Categorías oficiales del Formulario GP — SRI Ecuador (LORTI)
  // Transporte y Entretenimiento NO son categorías reconocidas por el SRI.
  const PERSONAL_CATEGORIES = [
    "Vivienda", "Salud", "Alimentación", "Educación",
    "Vestimenta", "Turismo", "Otros",
  ];

  // Guarded close: warn user when they have confirmed entries but haven't
  // finished the queue — so they know their work IS already saved.
  const handleClose = () => {
    if (queuePosition && confirmedCount > 0) {
      const remaining = queuePosition.total - queuePosition.current + 1;
      const ok = window.confirm(
        `Se han guardado ${confirmedCount} asiento(s) exitosamente.\n\n` +
        `Quedan ${remaining} factura(s) sin revisar en esta sesión.\n\n` +
        `¿Desea cerrar? Los asientos ya confirmados están guardados y no se perderán.`
      );
      if (!ok) return;
    }
    onClose();
  };

  const invoiceType: "sale" | "expense" =
    metadata.invoiceType ?? "expense";

  const initialPosition = useRef({
    x: window.innerWidth / 2 - 430,
    y: window.innerHeight / 2 - 320,
  });

  const pickerAccounts = useMemo(
    () => (postableAccounts?.length ? postableAccounts : accounts ?? []),
    [postableAccounts, accounts]
  );

  const transactionId = useMemo(() => {
  return entries[0]?.transactionId ?? crypto.randomUUID();
}, [entries]);

  // -------------------------------------------------------------------------
  // INIT
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!open) {
      setRows([]);
      setIsPersonalExpense(false);
      setPersonalCategory("Otros");
      return;
    }

    const invoiceNumber = metadata.invoice_number ?? "";
    let prepared: Row[] = [];

    if (entries?.length > 0) {
      const map = new Map<string, Row>();

      for (const e of entries) {
        const code = normalizeCode(e.account_code);
        const debit = Number(e.debit ?? 0);
        const credit = Number(e.credit ?? 0);

        const side = debit > 0 ? "D" : "C";
        const isIVA =
          code.startsWith("201") ||
          code.startsWith("12");

        let key = `${code}-${side}`;
        if (isIVA) key = `IVA-${invoiceType}`;

        if (!map.has(key)) {
          map.set(key, {
            ...e,
            id: e.id ?? crypto.randomUUID(),
            transactionId: e.transactionId ?? transactionId,
            debit,
            credit,
            entityId: e.entityId ?? entityId,
            uid: (e as any).uid ?? userIdSafe,
          });
        } else {
          const existing = map.get(key)!;

          if (!key.startsWith("IVA-")) {
            existing.debit += debit;    
            existing.credit += credit;
          }
        }
      }

      prepared = Array.from(map.values());
    } else {
      prepared = [
        createEmptyRow(
          entityId,
          userIdSafe,
          transactionId,
          toISODate(metadata.invoiceDate),
          invoiceNumber
        ),
      ];
    }

    setRows(prepared);
    setSelectedIdx(null);

    const party =
      invoiceType === "sale"
        ? metadata.buyerName
        : metadata.issuerName;

    // If any entry has documentRef (retention cert number), this is a retention
    const retentionCert = entries.find(
      (e) => (e as any).documentRef && (e as any).documentRef !== e.invoice_number
    );
    const docLabel = retentionCert ? "Retención" : "Factura";

    setNote(
      invoiceNumber
        ? `${docLabel} ${invoiceNumber}${party ? ` · ${party}` : ""}`
        : ""
    );

  }, [open, entries, metadata, entityId, userIdSafe, invoiceType, transactionId]);

  // -------------------------------------------------------------------------
  // PATCH
  // -------------------------------------------------------------------------

  const patchRow = (idx: number, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    );
  };

  // -------------------------------------------------------------------------
  // TOTALS
  // -------------------------------------------------------------------------

  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + (r.debit ?? 0), 0);
    const credit = rows.reduce((s, r) => s + (r.credit ?? 0), 0);

    const mathBalanced = Math.abs(debit - credit) < 0.01;
    const leafOk = areAllRowsPostable(rows, postableAccounts);

    let structureOk = true;
    try {
      structureOk = validateJournalStructure(rows, invoiceType);
    } catch {
      structureOk = false;
    }

    console.log("ROWS", rows);
    console.log("LEAF SET", leafCodeSet);
    console.log("LEAF OK", leafOk);

    return { debit, credit, mathBalanced, leafOk, structureOk };
  }, [rows, postableAccounts, invoiceType]);

  // -------------------------------------------------------------------------
  // ROW ACTIONS
  // -------------------------------------------------------------------------

  const addRow = () => {
    setRows((prev) => {
      const last = prev[prev.length - 1];

      if (
        last &&
        !last.account_code &&
        !last.debit &&
        !last.credit
      ) {
        return prev;
      }

      return [
        ...prev,
        createEmptyRow(
          entityId, 
          userIdSafe, 
          transactionId,
          toISODate(metadata.invoiceDate),
          metadata.invoice_number),
      ];
    });
  };

  const insertRow = (idx: number) => {
  const newRow = createEmptyRow(
    entityId,
    userIdSafe,
    transactionId,
    toISODate(metadata.invoiceDate),
    metadata.invoice_number
  );

  setRows(prev => {
    const next = [...prev];
    next.splice(idx + 1, 0, newRow);
    return next;
  });

  setSelectedIdx(idx + 1);
};

  const removeRow = (idx: number) => {
    setRows((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  };

  // -------------------------------------------------------------------------
  // SAVE
  // -------------------------------------------------------------------------

  const handleSave = async () => {
    if (saving) return;

    const authUid = getAuth().currentUser?.uid;

    if (!authUid || authUid !== userIdSafe) {
      alert("Sesión inválida.");
      return;
    }

    if (!totals.mathBalanced) {
      alert("El asiento no está balanceado.");
      return;
    }

    if (!totals.leafOk) {
      alert("Solo se permiten subcuentas finales.");
      return;
    }

    const meaningfulRows = rows.filter(
      (r) => r.account_code && (r.debit > 0 || r.credit > 0)
    );

    if (meaningfulRows.length < 2) {
      alert("El asiento debe tener al menos dos líneas válidas.");
      return;
    }

    setSaving(true);

    try {
      const invoiceNumber = metadata.invoice_number ?? "";

      const personalTag = isPersonalExpense ? `[Personal: ${personalCategory}]` : "";
      const fullDescription = [personalTag, note.trim()].filter(Boolean).join(" ");

      const normalized: JournalEntry[] = rows.map((r) => ({
        ...r,
        transactionId,
        account_code: (r.account_code ?? "").replace(/\./g, "").trim(),
        account_name: (r.account_name ?? "").trim(),
        description: fullDescription || r.description || "",
        entityId,
        uid: userIdSafe,
        invoice_number: r.invoice_number ?? invoiceNumber,
        debit: Number(r.debit ?? 0),
        credit: Number(r.credit ?? 0),
      }));

      // 🔥 LEARNING PRESERVED
      await Promise.all(
        normalized
          .filter((r) => r.account_code && r.account_name)
          .map((r) =>  
            saveContextualAccountHint(
              userIdSafe,
              entityId,
              metadata.issuerName ?? "",
              r.account_code,
              r.account_name,
              invoiceType,
            )
          )
      );
      
      await onSave(normalized, note);
      // Navigation is handled by the parent (queue advance or modal close)
    } catch (err) {
      console.error(err);
      alert("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  console.log("ALL ACCOUNTS", accounts.length);
  console.log("POSTABLE ACCOUNTS", postableAccounts.length);
  console.log("POSTABLE LIST", postableAccounts.map(a => a.code));

  const rowsValid =
  rows
    .filter((r) => {
      // Only consider rows with real data
      return (
        (r.account_code && r.account_code.trim() !== "") ||
        (r.debit ?? 0) > 0 ||
        (r.credit ?? 0) > 0
      );
    })
    .every((r) => {
      return (
        r.account_code &&
        r.account_code.trim() !== "" &&
        ((r.debit ?? 0) > 0 || (r.credit ?? 0) > 0)
      );
    });

  // -------------------------------------------------------------------------
  // METADATA
  // -------------------------------------------------------------------------

  const isSale = invoiceType === "sale";

  const partyLabel = isSale ? "Cliente" : "Proveedor";
  const partyName = isSale
    ? metadata.buyerName ?? "-"
    : metadata.issuerName ?? "-";
  const partyRUC = isSale
    ? metadata.buyerRUC ?? "-"
    : metadata.issuerRUC ?? "-";

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      <Rnd
        disableDragging={saving}
        default={{
          x: initialPosition.current.x,
          y: initialPosition.current.y,
          width: 860,
          height: "auto",
        }}
        enableResizing={false}
        dragHandleClassName="drag-header"
        bounds="window"
        className="bg-white rounded-xl shadow-2xl"
      >
        {/* HEADER */}

        <div className="drag-header bg-blue-600 text-white px-6 py-4 rounded-t-xl flex justify-between items-center cursor-move">
          <div className="flex items-center gap-3">
            <span className="text-xl font-semibold">
              Vista previa de asiento contable IA
            </span>
            {queuePosition && (
              <span className="bg-blue-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                Factura {queuePosition.current} de {queuePosition.total}
              </span>
            )}
            {queuePosition && confirmedCount > 0 && (
              <span className="bg-emerald-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                ✔ {confirmedCount} guardada{confirmedCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <button onClick={handleClose} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* BODY */}

        <div className="p-5 space-y-4">
          <div className="bg-gray-100 rounded-lg p-4 text-sm grid grid-cols-2 gap-4">
            <div>
              <div>
                <b>{partyLabel}:</b> {partyName}
              </div>
              <div>
                <b>RUC:</b> {partyRUC}
              </div>
            </div>

            <div>
              <div>
                <b>{entries.some((e) => (e as any).documentRef && (e as any).documentRef !== e.invoice_number) ? "Retención" : "Factura"}:</b> {metadata.invoice_number ?? "-"}
              </div>
              <div>
                <b>Fecha:</b> {new Date(toISODate(metadata.invoiceDate)).toLocaleDateString("es-EC")}
              </div>
            </div>
          </div>

          {/* TABLE */}

          <div className="border rounded-lg">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-2 text-left w-[110px]">Código</th>
                  <th className="p-2 text-left">Cuenta</th>
                  <th className="p-2 text-right w-[130px]">Débito</th>
                  <th className="p-2 text-right w-[130px]">Crédito</th>
                  <th className="w-[40px]" />
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => (
                  <React.Fragment key={r.id}>
                  <tr
                    className={`border-t ${
                      selectedIdx === idx ? "bg-emerald-50" : ""
                    }`}
                    onMouseDown={() => setSelectedIdx(idx)}
                  >
                    <td className="p-2 font-mono">{r.account_code}</td>

                    <td className="p-2">
                      <AccountPicker
                        accounts={pickerAccounts}
                        value={
                          r.account_code
                            ? { code: r.account_code, name: r.account_name }
                            : null
                        }
                        onChange={(acc) => {
                          if (!acc) {
                            patchRow(idx, {
                              account_code: "",
                              account_name: "",
                            });
                            return;
                          }
                          patchRow(idx, {
                            account_code: acc.code,
                            account_name: acc.name,
                          });
                        }}
                      />
                    </td>

                    <td className="p-2">
                      <input
                        type="text"
                        className="w-full border rounded px-2 py-1 text-right font-mono"
                        value={
                          r._debitRaw !== undefined
                            ? r._debitRaw
                            : r.debit !== 0
                            ? String(r.debit) 
                            : ""
                        }

                        onChange={(e) => {
                          const raw = e.target.value;
                          const num = parseMoney(raw);

                          patchRow(idx, {
                            _debitRaw: raw,
                            debit: num,
                            credit: 0,
                          });
                        }}

                        onBlur={(e) => {
                          const num = parseMoney(e.target.value);

                          patchRow(idx, {
                            debit: num,
                            _debitRaw: num ? formatMoney(num) : "",
                          });
                        }}
                      />
                    </td>

                    <td className="p-2">
                      <input
                        type="text"
                        className="w-full border rounded px-2 py-1 text-right font-mono"
                        value={
                          r._creditRaw !== undefined 
                            ? r._creditRaw
                            : r.credit !== 0
                            ? String(r.credit) 
                            : ""
                        }

                        onChange={(e) => {
                          const raw = e.target.value;
                          const num = parseMoney(raw);

                          patchRow(idx, {
                            _creditRaw: raw,
                            credit: num,
                            debit: 0,
                          });
                        }}

                        onBlur={(e) => {
                          const num = parseMoney(e.target.value);

                          patchRow(idx, {
                            credit: num,
                            _creditRaw: num ? formatMoney(num) : "",
                          });
                        }}
                      />
                    </td>

                    <td className="p-2 text-center">
                      <button onClick={() => removeRow(idx)}>×</button>
                    </td>
                  </tr>

                  <tr>
                    <td colSpan={5} className="px-2 py-1">
                      <button
                        onClick={() => insertRow(idx)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        + Insertar línea
                      </button>
                    </td>
                  </tr>
                  </React.Fragment>
                ))}

               
                <tr className="border-t-2 font-semibold bg-gray-100">
                  <td colSpan={2} className="p-2 text-right">
                    Totales
                  </td>

                  <td className="p-2 text-right font-mono">
                    {formatMoney(totals.debit)}
                  </td>

                  <td className="p-2 text-right font-mono">
                    {formatMoney(totals.credit)}
                  </td>

                  <td className="text-center">
                    {totals.mathBalanced
                      ? <span className="text-emerald-600">✔</span>
                      : <span className="text-amber-500">⚠</span>
                    }
                  </td>
                </tr>

                {/* BALANCE DIFFERENCE HINT */}
                {!totals.mathBalanced && (() => {
                  const diff = Math.abs(totals.debit - totals.credit);
                  const needsDebit = totals.credit > totals.debit;
                  return (
                    <tr className="bg-amber-50 border-t border-amber-200">
                      <td colSpan={5} className="px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-amber-700 font-medium">
                            ⚠ Diferencia:{" "}
                            <span className="font-mono font-bold">
                              ${formatMoney(diff)}
                            </span>
                          </span>
                          <span className="text-amber-600">
                            Añade{" "}
                            <span className="font-mono font-bold">
                              ${formatMoney(diff)}
                            </span>{" "}
                            al{" "}
                            <span className="font-bold">
                              {needsDebit ? "Débito" : "Crédito"}
                            </span>{" "}
                            para balancear
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* PERSONAL / BUSINESS TOGGLE (expenses only) */}
          {invoiceType === "expense" && (
            <div className="flex items-center gap-4 bg-gray-50 rounded-lg px-4 py-2.5 border">
              <span className="text-sm font-medium text-gray-700">Tipo de gasto:</span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm">
                <input
                  type="radio"
                  name="expenseNature"
                  checked={!isPersonalExpense}
                  onChange={() => setIsPersonalExpense(false)}
                  className="accent-blue-600"
                />
                <span className={!isPersonalExpense ? "font-semibold text-blue-700" : "text-gray-600"}>
                  🏢 Empresarial
                </span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm">
                <input
                  type="radio"
                  name="expenseNature"
                  checked={isPersonalExpense}
                  onChange={() => setIsPersonalExpense(true)}
                  className="accent-purple-600"
                />
                <span className={isPersonalExpense ? "font-semibold text-purple-700" : "text-gray-600"}>
                  👤 Personal
                </span>
              </label>
              {isPersonalExpense && (
                <select
                  value={personalCategory}
                  onChange={(e) => setPersonalCategory(e.target.value)}
                  className="ml-2 border rounded px-2 py-1 text-sm bg-white"
                >
                  {PERSONAL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* FOOTER */}

          <div className="flex justify-between items-center">
            <input
              className="flex-1 border rounded px-3 py-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota / concepto"
            />

            <div className="flex gap-3 ml-4">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                {queuePosition ? "Cancelar todo" : "Cancelar"}
              </button>

              {onSkip && (
                <button
                  onClick={onSkip}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                >
                  Omitir
                </button>
              )}

              <button
                onClick={handleSave}
                disabled={
                  saving ||
                  !totals.mathBalanced ||
                  !totals.leafOk ||
                  !rowsValid
                }
                className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-50 hover:bg-emerald-700"
              >
                {saving
                  ? "Guardando..."
                  : queuePosition && queuePosition.current < queuePosition.total
                  ? "Confirmar y Siguiente →"
                  : "Confirmar Asiento"}
              </button>
            </div>
          </div>
        </div>
      </Rnd>
    </div>
  );
}