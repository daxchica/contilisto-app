// ============================================================================
// src/components/JournalPreviewModal.tsx
// CONTILISTO — STABLE & DRAG-SAFE VERSION
// ============================================================================

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Rnd } from "react-rnd";

import type { Account } from "../../types/AccountTypes";
import type { JournalEntry } from "../../types/JournalEntry";

import AccountPicker from "../AccountPicker";
import { saveContextualAccountHint } from "@/services/firestoreHintsService";
import type { InvoicePreviewMetadata } from "@/types/InvoicePreviewMetadata";
import { validateJournalStructure } from "@/utils/validateJournalStructure.ts";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  entries: JournalEntry[];
  metadata: InvoicePreviewMetadata;
  accounts: Account[];
  entityId: string;
  userId: string;
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

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(n: number | string | undefined | null) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0.00";
  return moneyFormatter.format(v);
}

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
  userId: string,
  invoiceNumber?: string,
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
    invoice_number: invoiceNumber,
    source: "edited",
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------

export default function JournalPreviewModal({
  open,
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
  // STABLE INITIAL POSITION (CRITICAL FIX)
  // -------------------------------------------------------------------------

  const initialPosition = useRef({
    x: Math.max(20, window.innerWidth / 2 - 450),
    y: Math.max(20, window.innerHeight / 2 - 300),
  });
 
  // -------------------------------------------------------------------------
  // ACCOUNTS
  // -------------------------------------------------------------------------

  const leafAccounts = useMemo(
    () => accounts.filter((a) => isLeafAccount(a, accounts)),
    [accounts]
  );

  // -------------------------------------------------------------------------
  // INIT ROWS
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!open) return;

    const invoiceNumber = metadata.invoice_number ?? "";
    
    
    const prepared =
      entries.length > 0
        ? entries.map((e) => ({
            ...e,
            id: e.id ?? crypto.randomUUID(),
            debit: Number(e.debit ?? 0),
            credit: Number(e.credit ?? 0),
            date: e.date ?? todayISO(),
            invoice_number: e.invoice_number ?? invoiceNumber,
          }))
        : [createEmptyRow(entityId, userId, invoiceNumber)];

    // 🔹 AUTO-ADD IVA ROW IF MISSING (EXPENSE ONLY)
    if (metadata.invoiceType === "expense") {
      const hasIVA = prepared.some(r => r.account_code?.startsWith("133"));
      const hasExpense = prepared.find(r => r.account_code?.startsWith("5"));
      const hasAP = prepared.find(r => r.account_code?.startsWith("201"));

      if (!hasIVA && hasExpense && hasAP) {
        const ivaBase = hasExpense.debit || 0;
        const ivaAmount = Number((ivaBase * 0.15).toFixed(2));

        if (ivaAmount > 0) {
          // Insert IVA BEFORE Accounts Payable
          prepared.splice(
            prepared.indexOf(hasAP),
            0,
            {
              ...createEmptyRow(entityId, userId),
              account_code: "133010102",
              account_name: "IVA crédito en compras",
              debit: ivaAmount,
              credit: 0,
            }
          );

          // Increase AP credit to keep balance
          hasAP.credit = Number((hasAP.credit + ivaAmount).toFixed(2));
        }
      }
    }

    setRows(prepared);

    if (metadata.invoiceType === "sale") {
      const parts = [
        invoiceNumber && `Factura de venta ${invoiceNumber}`,
        metadata.buyerName && `Cliente: ${metadata.buyerName}`,
      ].filter(Boolean);

      setNote(parts.join(" · "));
      
    } else {
      const mainExpense = prepared.find((e) =>
        e.account_code?.startsWith("5")
      );
      const desc = mainExpense?.account_name ?? "";
      setNote(
        invoiceNumber && desc
          ? `Factura ${invoiceNumber} - ${desc}`
          : invoiceNumber || desc
      );
    }
  }, [open, entries, metadata, entityId, userId]);

  // -------------------------------------------------------------------------
  // TOTALS
  // -------------------------------------------------------------------------

  const totals = useMemo(() => {
    const debit = Number(rows.reduce((s, r) => s + r.debit, 0).toFixed(2));
    const credit = Number(rows.reduce((s, r) => s + r.credit, 0).toFixed(2));

    const balanced = validateJournalStructure(
      rows,
      metadata.invoiceType
    );

    return { debit, credit, balanced };
  }, [rows, metadata.invoiceType]);

  // -------------------------------------------------------------------------
  // SAVE
  // -------------------------------------------------------------------------

  const handleSave = async () => {
    if (saving || !totals.balanced ) return;
    
    setSaving(true);
    
    try {
      // 🔧 NORMALIZE before sending up
      const normalized: JournalEntry[] = rows.map(r => ({
        ...r,
        debit: Number(r.debit ?? 0),
        credit: Number(r.credit ?? 0),
        invoice_number: r.invoice_number ?? metadata.invoice_number,
      }));

      // 1️⃣ Guardar asiento (CRÍTICO)
      await onSave(normalized, note);
      // -----------------------------------------------------
      // 1️⃣ AI LEARNING (NON-BLOCKING)
      // -----------------------------------------------------
      if (metadata.invoiceType === "expense" && metadata.issuerRUC) {
        normalized.forEach(r => {
          const debit = r.debit ?? 0;

          if (
            (r.debit ?? 0) > 0 &&
            r.account_code?.startsWith("5")
          ) {
            saveContextualAccountHint(
              userId,
              metadata.issuerRUC,
              metadata.issuerName,
              note,
              r.account_code,
              r.account_name ?? ""
            ).catch(() => {});
          }
        });
      }
  
      onClose();
      } catch (err) {
        console.error("Error saving journal:", err);
        alert("Error al guardar el asiento. Revisa permisos o conexion.");
      } finally {
        setSaving(false);
      }
    };

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

  const addRow = () =>
    setRows((prev) => [...prev, createEmptyRow(entityId, userId)]);

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
    const r = rows[idx];

    const IVA_PREFIX = "133";
    const AP_PREFIX = "201";

    if ( r.account_code?.startsWith(IVA_PREFIX) || r.account_code?.startsWith(AP_PREFIX)
    ) {
      alert("Esta linea es obligatoria para facturas de gasto");
      return;
    }

    if (rows.length <= 2) {
      alert("El asiento debe tener al menos dos lineas");
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  // -------------------------------------------------------------------------
  // METADATA LABELS (SRI RULE)
  // -------------------------------------------------------------------------

  const isSale = metadata.invoiceType === "sale";
  const partyLabel = isSale ? "Cliente" : "Proveedor";
  const partyName = isSale ? metadata.buyerName : metadata.issuerName || "Proveedor no detectado";
  const partyRUC = isSale ? metadata.buyerRUC ?? "" : metadata.issuerRUC;

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  return (
    <div className={`fixed inset-0 z-50 transition-opacity ${
      open ? "bg-black/50 pointer-events-auto" : "pointer-events-none opacity-0"}`}>
      <Rnd
        disableDragging={saving}
        defaultPosition={initialPosition.current}
        onDragStop={(_, data) => 
          { initialPosition.current = { x: data.x, y: data.y };
        }}
        enableResizing={false}
        updatePositionOnResize={false}
        dragHandleClassName="drag-header"
        cancel="input, textarea, button, select, .account-picker"
        bounds="window"
        style={{ width: 900 }}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 text-sm bg-gray-100 p-4 rounded">
          {/* LEFT COLUMN - CLIENT */}
          <div className="space-y-1">
            <div className="flex gap-2">
              <span className="font-semibold">{partyLabel}:</span>
              <span className="break-words">{partyName || "-"}</span>
            </div>

            <div className="flex gap-2">
              <div className="font-semibold">RUC:</div>
              <div>{partyRUC || "-"}</div>
            </div>
          </div>
          
          
          {/* RIGHT COLUMN - DOCUMENT */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <span className="font-semibold">Factura:</span>
              <span>{metadata.invoice_number || "-"}</span>
            </div>

            <div className="flex gap-2">
              <span className="font-semibold">Fecha:</span>
              <span>{metadata.invoiceDate || "-"}</span>
            </div>
          </div> 
        </div> 

          {/* ACTIONS */}
          <div className="flex justify-end gap-2">
            <button onClick={addRow} className="px-3 py-1 bg-emerald-600 text-white rounded">
              ➕ Agregar
            </button>
            <button 
              onClick={duplicateRow}
              disabled={selectedIdx == null} 
              className="px-3 py-1 bg-indigo-600 text-white rounded">
              ⧉ Duplicar
            </button>
          </div>

          <div className="no-drag">
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
                  onMouseDown={(e) => {
                    if ((e.target as HTMLElement).closest("input, button, [role='listbox']")) {
                      return;
                    }
                  
                  setSelectedIdx(idx)
                  }}
                  className={selectedIdx === idx ? "bg-emerald-50" : ""}
                >
                  <td className="border p-2 font-mono">{r.account_code}</td>
                  <td className="border p-2">
                    <AccountPicker
                      key={`account-picker-${r.id}`}
                      accounts={leafAccounts}
                      value={{ code: r.account_code ?? "", name: r.account_name ?? "" }}
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
                      type="text"
                      inputMode="decimal"
                      className="w-full border rounded px-2 py-1 text-right"
                      value={r.debit ? formatMoney(r.debit) : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(",", ".");
                        const num = Number(raw);
                        patchRow(idx, {
                          debit: Number.isFinite(num) ? num : 0,
                          credit: 0,
                        })
                      }}
                      onBlur={() => {
                        patchRow(idx, {
                          debit: Number(Number(r.debit || 0).toFixed(2)),
                        });
                      }}
                    />
                  </td>
                  <td className="border p-2 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full border rounded px-2 py-1 text-right"
                      value={r.credit ? formatMoney(r.credit) : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(",", ".");
                        const num = Number(raw);
                        patchRow(idx, {
                          credit: Number.isFinite(num) ? num : 0,
                          debit: 0,
                        });
                      }}
                      onBlur={() => {
                        patchRow(idx, {
                          credit: Number(Number(r.credit || 0).toFixed(2)),
                        });
                      }}
                    />
                  </td>
                  <td className="border p-2 text-center">
                    <button onClick={() => removeRow(idx)}>✖</button>
                  </td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-100 border-t-2 border-gray-400">
                {/* Código */}
                <td className="border p-2" />

                {/* Cuenta */}
                <td className="border p-2 text-right">Totales</td>

                {/* Débito */}
                <td className="border p-2">
                  <div className="w-full px-2 py-1 text-right">
                    {formatMoney(totals.debit)}
                  </div>
                </td>

                {/* Crédito */}
                <td className="border p-2">
                  <div className="w-full px-2 py-1 text-right">
                    {formatMoney(totals.credit)}
                  </div>
                </td>

                {/* Status */}
                <td className="border p-2 text-center">
                  {totals.balanced ? "✔" : "⚠"}
                </td>
              </tr>
            </tbody>
          </table>
          </div>

          {/* NOTE */}
          <div className="flex gap-3 items-center">
            <input
              className="flex-1 border rounded px-3 py-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <span className={totals.balanced ? "text-green-600" : "text-red-600"}>
              {totals.balanced 
                ? "✔ Balanceado" 
                : "⚠ Desbalance"
              }
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