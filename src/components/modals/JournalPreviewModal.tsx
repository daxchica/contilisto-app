// ============================================================================
// src/components/JournalPreviewModal.tsx
// CONTILISTO — STABLE PRODUCTION VERSION (COMPACT OLD UI)
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

import { isCustomerReceivableAccount, isSupplierPayableAccount } from "@/services/controlAccounts";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  entries: JournalEntry[];
  metadata: InvoicePreviewMetadata;

  accounts: Account[];
  leafAccounts: Account[];
  leafCodeSet: Set<string>;

  entityId: string;
  userIdSafe: string;

  onClose: () => void;
  onSave: (entries: JournalEntry[], note: string) => Promise<void>;
}

type Row = Omit<JournalEntry, "debit" | "credit"> & {
  debit: number;
  credit: number;
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const todayISO = () => new Date().toISOString().slice(0, 10);

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const toISODateOrNull = (raw: string): string | null => {
  const s = (raw ?? "").trim();
  if (!s) return null;

  // ISO date or ISO datetime
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // DD/MM/YYYY (or MM/DD/YYYY)
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);

    // Ecuador default: DD/MM/YYYY
    let day = a;
    let month = b;

    // If clearly MM/DD/YYYY (second part can't be month)
    if (a <= 12 && b > 12) {
      day = b;
      month = a;
    }

    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  return null;
};

const formatMoney = (n: number) =>
  moneyFormatter.format(Number.isFinite(n) ? n : 0);

const parseMoney = (raw: string) => {
  const cleaned = (raw ?? "").replace(/\s/g, "").replace(",", ".");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
};

const createEmptyRow = (
  entityId: string,
  uid: string,
  invoice?: string
): Row => ({
  id: crypto.randomUUID(),
  entityId,
  uid,
  date: todayISO(),
  account_code: "",
  account_name: "",
  debit: 0,
  credit: 0,
  description: "",
  invoice_number: invoice ?? "",
  source: "edited",
  createdAt: Date.now(),
});

const areAllRowsPostable = (
  rows: Row[],
  leafCodeSet: Set<string>
) =>
  rows.every((r) =>
    leafCodeSet.has((r.account_code ?? "").trim())
  );

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------

export default function JournalPreviewModal({
  open,
  entries,
  metadata,
  accounts,
  leafAccounts,
  leafCodeSet,
  entityId,
  userIdSafe,
  onClose,
  onSave,
}: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const invoiceType: "sale" | "expense" = metadata.invoiceType ?? "expense";

  // -------------------------------------------------------------------------
  // DRAG SAFE POSITION
  // -------------------------------------------------------------------------

  const initialPosition = useRef({
    x:
      typeof window !== "undefined"
        ? Math.max(20, window.innerWidth / 2 - 520)
        : 100,
    y:
      typeof window !== "undefined"
        ? Math.max(20, window.innerHeight / 2 - 360)
        : 100,
  });

  const pickerAccounts = useMemo(
    () => (leafAccounts?.length ? leafAccounts : accounts ?? []),
    [leafAccounts, accounts]
  );

  // -------------------------------------------------------------------------
  // INIT
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!open) {
      setRows([]);
      return;
    }

    const invoiceNumber = metadata.invoice_number ?? "";

    const prepared =
      entries?.length > 0
        ? entries.map((e) => ({
            ...e,
            id: e.id ?? crypto.randomUUID(),
            debit: Number(e.debit ?? 0),
            credit: Number(e.credit ?? 0),
            date: toISODateOrNull(String(e.date ?? "")) ?? todayISO(),
            entityId: e.entityId ?? entityId,
            uid: (e as any).uid ?? userIdSafe,
          }))
        : [createEmptyRow(entityId, userIdSafe, invoiceNumber)];

    setRows(prepared);

    const party =
      invoiceType === "sale"
        ? metadata.buyerName
        : metadata.issuerName;

    setNote(
      invoiceNumber
        ? `Factura ${invoiceNumber}${
            party ? ` · ${party}` : ""
          }`
        : ""
    );

    setSelectedIdx(null);
  }, [open, entries, metadata, entityId, userIdSafe, invoiceType]);

  // -------------------------------------------------------------------------
  // PATCH
  // -------------------------------------------------------------------------

  const patchRow = (idx: number, patch: Partial<Row>) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // TOTALS
  // -------------------------------------------------------------------------

  const totals = useMemo(() => {
    const debit = Number( rows.reduce((s, r) => s + Number(r.debit ?? 0), 0).toFixed(2));
    const credit = Number( rows.reduce((s, r) => s + Number(r.credit ?? 0), 0).toFixed(2));

    const mathBalanced = Math.abs(debit - credit) < 0.01;
    const leafOk = areAllRowsPostable(rows, leafCodeSet);

    let structureOk = true;
    try {
      structureOk = validateJournalStructure(rows, invoiceType);
    } catch {
      structureOk = false;
    }

    console.log("ROWS:", rows.map(r => r.account_code));
    console.log("LEAF CHECK:", rows.map(r =>
      leafCodeSet.has((r.account_code ?? "").trim())
    ));
    console.log("leafCodeSet size:", leafCodeSet.size);

    return { debit, credit, mathBalanced, leafOk, structureOk };
  }, [rows, leafCodeSet, invoiceType]);

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

    console.log("Selected codes:", rows.map(r => r.account_code));
    console.log("Leaf set:", Array.from(leafCodeSet));

    console.log("Leaf contains 401010101:", leafCodeSet.has("401010101"));
    console.log("Leaf contains 213010101:", leafCodeSet.has("213010101"));
    console.log("Leaf contains 101030101:", leafCodeSet.has("101030101"));

    setSaving(true);

    try {
      const invoiceNumber = metadata.invoice_number ?? "";

      let normalized: JournalEntry[] = rows.map((r) => ({
        ...r,
        account_code: (r.account_code ?? "").trim(),
        account_name: (r.account_name ?? "").trim(),
        entityId,
        uid: userIdSafe,
        invoice_number:
          (r.invoice_number ?? invoiceNumber) || "",
        debit: Number(Number(r.debit ?? 0).toFixed(2)),
        credit: Number(Number(r.credit ?? 0).toFixed(2)),
        date: toISODateOrNull(r.date ?? "") ?? todayISO(),
      }));

      // ✅ KEY FIX: Inject identity into CONTROL line (subledger link)
      if (invoiceType === "sale") {
        const customerName = (metadata.buyerName ?? "").trim();
        const customerRUC = (metadata.buyerRUC ?? "").trim();

        if (customerName || customerRUC) {
          normalized = normalized.map((e) => {
            if (!isCustomerReceivableAccount(e.account_code)) return e;

            return {
              ...e,
              // support BOTH naming styles (your services read both)
              customer_name: customerName,
              customer_ruc: customerRUC,
              customerName,
              customerRUC,
            } as any;
          });
        }
      } else {
        // expense: inject supplier identity into AP control line if present
        const supplierName = (metadata.issuerName ?? "").trim();
        const supplierRUC = (metadata.issuerRUC ?? "").trim();

        if (supplierName || supplierRUC) {
          normalized = normalized.map((e) => {
            if (!isSupplierPayableAccount(e.account_code)) return e;

            return {
              ...e,
              supplier_name: supplierName,
              supplier_ruc: supplierRUC,
              supplierName,
              supplierRUC,
              issuerName: supplierName,
              issuerRUC: supplierRUC,
            } as any;
          });
        }
      }

      await onSave(normalized, note);

       // Optional learning (expense only)
      if (invoiceType === "expense") {
        const supplierRUC = (metadata.issuerRUC ?? "").trim();
        const supplierName = (metadata.issuerName ?? "PROVEEDOR").trim();

        if (supplierRUC) {
          const learned = new Set<string>();

          for (const r of normalized) {
            const code = (r.account_code ?? "").trim();
            const debit = Number(r.debit ?? 0);

            if (
              debit > 0 &&
              code.startsWith("5") &&
              leafCodeSet.has(code) &&
              !learned.has(code)
            ) {
              learned.add(code);

              void saveContextualAccountHint(
                entityId,
                authUid,
                supplierRUC,
                supplierName,
                code,
                r.account_name ?? "",
                note ?? "",
              ).catch((err) => {
                console.warn("Contextual learning skipped:", err);
              });
              }
            }
          }
        }

        onClose();
      } catch (err) {
        console.error(err);
        alert("Error al guardar.");
      } finally {
        setSaving(false);
      }
    };

  // -------------------------------------------------------------------------
  // ROW ACTIONS
  // -------------------------------------------------------------------------

  const addRow = () =>
    setRows((prev) => [...prev, createEmptyRow(entityId, userIdSafe, metadata.invoice_number),]);

  const duplicateRow = () => {
    if (selectedIdx == null) return;

    const copy: Row = {
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
    if (rows.length <= 2) {
      alert("Debe existir al menos dos líneas.");
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

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
        className="bg-white rounded-xl shadow-2xl w-full max-w-[920px]"
      >
        {/* HEADER */}
        <div className="drag-header bg-blue-600 text-white px-6 py-4 rounded-t-xl flex justify-between cursor-move">
          <span className="text-xl font-semibold">
            Vista previa de asiento contable IA
          </span>
          <button onClick={onClose}>×</button>
        </div>

        {/* BODY */}
        <div className="p-5 space-y-4">
          {/* METADATA */}
          <div className="bg-gray-100 rounded-lg p-4 text-sm grid grid-cols-2 gap-4">
            <div>
              <div><b>{partyLabel}:</b> {partyName}</div>
              <div><b>RUC:</b> {partyRUC}</div>
            </div>
            <div>
              <div><b>Factura:</b> {metadata.invoice_number ?? "-"}</div>
              <div><b>Fecha:</b> {metadata.invoiceDate ?? "-"}</div>
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
                  <th className="w-[40px]"/>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`border-t ${
                      selectedIdx === idx
                        ? "bg-emerald-50"
                        : ""
                    }`}
                    onMouseDown={() => setSelectedIdx(idx)}
                  >
                    <td className="p-2 font-mono w-[110px]">
                      {r.account_code}
                    </td>

                    <td className="p-2">
                      <AccountPicker
                        accounts={pickerAccounts}
                        value={{
                          code: r.account_code,
                          name: r.account_name,
                        }}
                        onChange={(acc) =>
                          patchRow(idx, {
                            account_code: acc.code,
                            account_name: acc.name,
                          })
                        }
                      />
                    </td>

                    <td className="p-2 w-[130px]">
                      <input
                        type="text"
                        className="w-full border rounded px-2 py-1 text-right font-mono"
                        value={
                          r.debit
                            ? formatMoney(r.debit)
                            : ""
                        }
                        onChange={(e) =>
                          patchRow(idx, {
                            debit: parseMoney(e.target.value),
                            credit: 0,
                          })
                        }
                      />
                    </td>

                    <td className="p-2 w-[130px]">
                      <input
                        type="text"
                        className="w-full border rounded px-2 py-1 text-right font-mono"
                        value={
                          r.credit
                            ? formatMoney(r.credit)
                            : ""
                        }
                        onChange={(e) =>
                          patchRow(idx, {
                            credit: parseMoney(e.target.value),
                            debit: 0,
                          })
                        }
                      />
                    </td>

                    <td className="p-2 text-center w-[40px]">
                      <button
                        onClick={() =>
                          removeRow(idx)
                        }
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}

                <tr className="border-t-2 font-semibold bg-gray-100">
                  <td colSpan={2} className="p-2 text-right">
                    Totales
                  </td>
                  <td className="w-[130px] p-2">
                   <div className="px-2 py-1 text-right font-mono">
                    {formatMoney(totals.debit)}
                    </div>
                  </td>
                  <td className="w-[130px] p-2">
                    <div className="px-2 py-1 text-right font-mono">
                    {formatMoney(totals.credit)}
                    </div>
                  </td>
                  <td className="text-center w-[40px]">
                    {totals.mathBalanced
                      ? "✔"
                      : "⚠"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* FOOTER */}
          <div className="flex justify-between items-center">
            <input
              className="flex-1 border rounded px-3 py-2 text-sm"
              value={note}
              onChange={(e) =>
                setNote(e.target.value)
              }
              placeholder="Nota / concepto"
            />

            <div className="flex gap-3 ml-4">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Cancelar
              </button>

              <button
                onClick={handleSave}
                disabled={
                  saving ||
                  !totals.mathBalanced ||
                  !totals.leafOk
                }
                className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-50"
              >
                Confirmar Asiento
              </button>
            </div>
          </div>
        </div>
      </Rnd>
    </div>
  );
}