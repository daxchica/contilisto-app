// ============================================================================
// src/components/JournalPreviewModal.tsx
// CONTILISTO ARCHITECTURE v1.0
//
// Component role:
// - Receive journal entries already built by the backend (OCR + Vision + Prompt).
// - Show key invoice metadata.
// - Let the user REVIEW and ADJUST:
//     • Account code
//     • Account name
//     • Description
//     • Debit / Credit
// - Validate that the journal entry is balanced.
// - Send entries + note back to parent via onSave().
//
// IMPORTANT ACv1:
// - We DO NOT re-classify or rebuild the journal from scratch here.
// - Accounting logic lives in the backend (extract-invoice-vision.ts).
//
// NEW RULE (Option A - Leaf Only):
// - The user can ONLY select leaf accounts (last level of the chart).
// - Dropdowns show ONLY leaf accounts.
// - Parent accounts cannot be selected.
// - No free-text: if user types a code/name that does not resolve to a leaf
//   account, the field is cleared on blur.
// ============================================================================

import React, { useState, useEffect, useMemo } from "react";
import { Rnd } from "react-rnd";
import type { Account } from "../types/AccountTypes";
import type { JournalEntry } from "../types/JournalEntry";

interface Props {
  entries: JournalEntry[];             // Asientos sugeridos por la IA (backend)
  metadata: any;                       // Datos de factura (proveedor, totales, etc.)
  accounts: Account[];                 // Plan de cuentas (PUC + personalizadas)
  entityId: string;                    // Empresa actual (reservado para futuras mejoras)
  userId: string;                      // Usuario actual (reservado para futuras mejoras)
  onClose: () => void;                 // Cerrar sin guardar
  onSave: (entries: JournalEntry[], note: string) => Promise<void>; // Guardar definitivo
}

// Tipo local: JournalEntry + control de picker de cuenta
type LocalEntry = JournalEntry & {
  showPicker?: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if this account is a "leaf" (no children in the chart). */
function isLeafAccount(account: Account, all: Account[]): boolean {
  return !all.some(
    (other) =>
      other.code !== account.code && other.code.startsWith(account.code)
  );
}

/** Normalize a string for comparison/search (code or name). */
function normalize(text: string | undefined | null): string {
  return (text || "").toLowerCase().trim();
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function JournalPreviewModal({
  entries,
  metadata,
  accounts,
  entityId,
  userId,
  onClose,
  onSave,
}: Props) {
  // Local editable copy of entries
  const [localEntries, setLocalEntries] = useState<LocalEntry[]>([]);
  const [note, setNote] = useState<string>("");

  // Precompute LEAF accounts only (last level)
  const leafAccounts = useMemo(
    () => accounts.filter((acc) => isLeafAccount(acc, accounts)),
    [accounts]
  );

  const leafCodesSet = useMemo(
    () => new Set(leafAccounts.map((a) => a.code)),
    [leafAccounts]
  );

  // --------------------------------------------------------------------------
  // Initialization: ALWAYS use entries from backend.
  // metadata only used for header + default note.
  // --------------------------------------------------------------------------
  useEffect(() => {
    // 1. Clone entries so we do not mutate the original prop
    const cloned: LocalEntry[] = (entries || []).map((e) => ({ ...e }));

    // 2. Ensure each line has a unique id
    const withIds = cloned.map((e) => ({
      ...e,
      id: e.id || crypto.randomUUID(),
      showPicker: false,
    }));

    setLocalEntries(withIds);

    // 3. Try to detect main expense line (code starting with "5")
    const mainExpense = entries.find(
      (e) =>
        typeof e.account_code === "string" &&
        e.account_code.trim().startsWith("5")
    );
    
    const expenseDescription = mainExpense?.account_name?.trim() || "";
    
    // 4. Extract invoice number
    const invoiceNumber =
      metadata?.invoice_number || entries?.[0]?.invoice_number || "";
    
    // 5. Build default note
    const glosa = 
      invoiceNumber && expenseDescription 
        ? `Factura ${invoiceNumber} - ${expenseDescription}` 
        : invoiceNumber
        ? `Factura ${invoiceNumber}`
        : expenseDescription;

    // Only set default note if it was empty (avoid overriding user edits
    // when reopening the modal with the same data).
    setNote((prev) => (prev ? prev : glosa || ""));
  }, [entries, metadata]);

  // --------------------------------------------------------------------------
  // Totals and balance
  // --------------------------------------------------------------------------
  const { totalDebit, totalCredit, isBalanced, diff } = useMemo(() => {
    const d = localEntries.reduce(
      (sum, e) => sum + (Number(e.debit) || 0),
      0
    );
    const c = localEntries.reduce(
      (sum, e) => sum + (Number(e.credit) || 0),
      0
    );
    const difference = d - c;

    return {
      totalDebit: d,
      totalCredit: c,
      isBalanced: Math.abs(difference) < 0.0001,
      diff: difference,
    };
  }, [localEntries]);

  // --------------------------------------------------------------------------
  // Generic field helpers
  // --------------------------------------------------------------------------

  function patchEntry(index: number, patch: Partial<LocalEntry>
  ) {
    setLocalEntries((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        ...patch,
      };
      return next;
    });
  }

  // Change numeric field (debit / credit)
  function updateNumberField(
    index: number,
    field: "debit" | "credit",
    value: string
  ) {
    const num = value === "" ? undefined : Number(value.replace(",", "."));
    setLocalEntries((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: isNaN(Number(num)) ? 0 : Number(num),
      };
      return next;
    });
  }

  // Apply a leaf account to a given row
  function applyLeafAccount(index: number, account: Account | null) {
    setLocalEntries((prev) => {
      const next = [...prev];
      if (!account) {
        next[index] = {
          ...next[index],
          account_code: "",
          account_name: "",
        };
      } else {
        next[index] = {
          ...next[index],
          account_code: account.code,
          account_name: account.name,
        };
      }
      return next;
    });
  }

  // Called when user types in account code input
  function handleCodeChange(index: number, rawCode: string) {
    patchEntry(index, {
      account_code: rawCode,
      showPicker: true,
    });
  }

  // Called when code input loses focus: enforce leaf-only + no free text
  function handleCodeBlur(index: number) {
    setLocalEntries((prev) => {
      const next = [...prev];
      const entry = next[index];
      const raw = (entry.account_code || "").trim();

      const exactMatch = leafAccounts.find((a) => a.code === raw);

      if (!raw || !exactMatch) {
        // Invalid code -> clear both fields
        entry.account_code = "";
        entry.account_name = "";
      } else {
        entry.account_code = exactMatch.code;
        entry.account_name = exactMatch.name;
      }

      entry.showPicker = false;
      return next;
    });
  }

  // When the user types in the account name
  function handleNameChange(index: number, value: string) {
    patchEntry(index, {
      account_name: value,
      showPicker: true,
    });
  }

  // Called when name input loses focus: enforce leaf-only + no free text
  function handleNameBlur(index: number) {
    setLocalEntries((prev) => {
      const next = [...prev];
      const entry = next[index];
      const raw = normalize(entry.account_name);

      if (!raw) {
        entry.account_code = "";
        entry.account_name = "";
        entry.showPicker = false;
        return next;
      }

      // 1) Exact name match
      let match = leafAccounts.find((a) => normalize(a.name) === raw);

      // 2) If no exact match and there is ONE partial match, accept it
      if (!match) {
        const partials = leafAccounts.filter((a) =>
          normalize(a.name).includes(raw)
        );
        if (partials.length === 1) {
          match = partials[0];
        }
      }

      if (!match) {
        // No valid leaf account -> clear
        entry.account_code = "";
        entry.account_name = "";
      } else {
        entry.account_code = match.code;
        entry.account_name = match.name;
      }

      entry.showPicker = false;
      return next;
    });
  }

  // Remove a line (for example, if AI added something extra)
  function removeLine(index: number) {
    setLocalEntries((prev) => prev.filter((_, i) => i !== index));
  }

  // Add an empty line
  function addEmptyLine() {
    const today =
      localEntries[0]?.date ||
      metadata?.invoiceDate ||
      new Date().toISOString().slice(0, 10);

    setLocalEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        date: today,
        description: "Línea adicional",
        account_code: "",
        account_name: "",
        debit: 0,
        credit: 0,
        type: "expense", // por defecto; se puede ajustar luego si es ingreso
        invoice_number:
          metadata?.invoice_number || prev[0]?.invoice_number || "",
        issuerRUC: metadata?.issuerRUC || prev[0]?.issuerRUC || "",
        issuerName: metadata?.issuerName || "",
        supplier_name: metadata?.supplier_name || "",
        invoiceDate:
          metadata?.invoiceDate || prev[0]?.invoiceDate || today,
        entityRUC: metadata?.buyerRUC || "",
        source: "vision",
        showPicker: false,
      } as LocalEntry,
    ]);
  }

  // --------------------------------------------------------------------------
  // Guardar (Confirmar Asiento)
  // --------------------------------------------------------------------------
  async function handleSave() {
    if (!isBalanced) {
      alert(
        "⚠ El asiento no está balanceado. Revisa la diferencia entre Débito y Crédito."
      );
      return;
    }

    // Enforce "leaf-only" rule on save
    const invalidLines = localEntries.filter(
      (e) => !leafCodesSet.has((e.account_code || "").trim())
    );

    if (invalidLines.length > 0) {
      const invalidCodes = Array.from(
        new Set(
          invalidLines
            .map((e) => (e.account_code || "").trim())
            .filter(Boolean)
        )
      ).join(", ");

      alert(
        `⚠ Solo se permiten cuentas de último nivel (hoja).\n` +
          `Revisa las líneas con códigos no válidos: ${invalidCodes || "sin código"}.`
      );
      return;
    }

    try {
      await onSave(localEntries, note || "");
    } catch (err: any) {
      console.error("❌ Error en onSave desde JournalPreviewModal:", err);
      alert(err?.message || "Error guardando los asientos.");
    }
  }

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <Rnd
        default={{
          x: 100,
          y: 40,
          width: 900,
          height: 600,
        }}
        minWidth={800}
        minHeight={480}
        disableDragging={false}
        enableResizing={false}
        dragHandleClassName="drag-header"
        className="bg-white rounded-xl shadow-2xl flex flex-col"
      >
        {/* HEADER */}
        <div className="drag-header bg-blue-600 text-white p-4 rounded-t-xl flex justify-between items-center cursor-move">
          <h2 className="text-lg font-bold">
            Vista previa de asiento contable IA
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-xl leading-none"
          >
            ✖
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* METADATA DE FACTURA */}
          {metadata && (
            <div className="mb-4 p-3 bg-gray-100 rounded text-sm grid grid-cols-1 md:grid-cols-2 gap-2">
              <p>
                <strong>Proveedor:</strong>{" "}
                {metadata.issuerName || "—"}
              </p>
              <p>
                <strong>RUC Proveedor:</strong>{" "}
                {metadata.issuerRUC || "—"}
              </p>
              <p>
                <strong>Factura Nº:</strong>{" "}
                {metadata.invoice_number || "—"}
              </p>
              <p>
                <strong>Fecha factura:</strong>{" "}
                {metadata.invoiceDate || "—"}
              </p>
              <p>
                <strong>Subtotal IVA:</strong>{" "}
                {metadata.subtotal15 ??
                  metadata.subtotal12 ??
                  0}
              </p>
              <p>
                <strong>Subtotal 0%:</strong>{" "}
                {metadata.subtotal0 ?? 0}
              </p>
              <p>
                <strong>IVA:</strong> {metadata.iva ?? 0}
              </p>
              <p>
                <strong>Total:</strong> {metadata.total ?? 0}
              </p>
            </div>
          )}

          {/* GLOBAL DATE FOR THE JOURNAL */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="block text-sm font-medium mb-1">Fecha del asiento:</label>
    
              <input
                type="date"
                className="border rounded px-3 py-2 text-sm"
                value={localEntries[0]?.date || ""}
                onChange={(ev) => {
                  const newDate = ev.target.value;
                  setLocalEntries(prev =>
                    prev.map(e => ({
                      ...e,
                      date: newDate,   // ← actualiza TODAS las líneas internamente
                    }))
                  );
                }}
              />
            </div>
            
            {/* ADD LINE BUTON */}
              <button
                type="button"
                onClick={addEmptyLine}
                className="px-3 py-1.5 text-xs md:text-sm bg-blue-50 text-blue-700 rounded border border-blue-300 hover:bg-blue-100"
              >
                ➕ Agregar línea
              </button>
          </div>

          {/* JOURNAL TABLE */}
          <div className="border rounded-lg overflow-visible relative">
            <table className="w-full table-auto text-xs md:text-sm">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-2 border">Código</th>
                  <th className="p-2 border">Cuenta</th>
                  <th className="p-2 border text-right px-6">Débito</th>
                  <th className="p-2 border text-right px-6">Crédito</th>
                  <th className="p-2 border w-10">✂</th>
                </tr>
              </thead>
              <tbody>
                {localEntries.map((e, i) => {
                  // Build suggestions list for dropdown (leaf accounts only)
                  const codeQuery = normalize(e.account_code);
                  const nameQuery = normalize(e.account_name);
                  const query = codeQuery || nameQuery;

                  const suggestions = query
                    ? leafAccounts.filter(
                        (acc) => 
                          normalize(acc.code).includes(query) ||
                          normalize(acc.name).includes(query)
                      )
                    : leafAccounts.slice(0, 50);

                  return (
                  <tr key={e.id || i} className="odd:bg-white even:bg-gray-50">
                    {/* Account code */}
                    <td className="border p-1 align-top">
                      <input
                        type="text"
                        className="w-full border rounded px-1 py-0.5 text-xs md:text-sm"
                        value={e.account_code || ""}
                        onChange={(ev) =>
                          handleCodeChange(i, ev.target.value)
                        }
                        onBlur={() => handleCodeBlur(i)}
                      />
                    </td>

                    {/* Account name + dropdown */}
                    <td className="border p-1 align-top relative w-80 max-w-xs">
                      <div className="relative">
                      {/* ACCOUNT NAME INPUT */}
                      <input
                        type="text"
                        className="w-full border rounded px-1 py-0.5 text-xs md:text-sm"
                        value={e.account_name || ""}
                        onChange={(ev) => 
                          handleNameChange(i, ev.target.value)}
                        onBlur={() => handleNameBlur(i)}
                        onFocus={() => patchEntry(i, { showPicker: true })}
                      />

                      {/* DROPDOWN (leaf accounts only) */}
                      {e.showPicker && suggestions.length > 0 && (
                        <div
                          className="absolute z-50 mt-1 w-full bg-white border rounded shadow-lg max-h-40 overflow-y-auto"
                        >
                          {suggestions.map((acc) => (
                            <div
                              key={acc.code}
                              className="px-2 py-1 cursor-pointer hover:bg-blue-100 text-xs"
                              onMouseDown={() => {
                                // IMPORTANT: use onMouseDown so blur does NOT fire first
                                setLocalEntries((prev) => {
                                  const next = [...prev];
                                  next[i].account_code = acc.code;
                                  next[i].account_name = acc.name;
                                  next[i].showPicker = false;
                                  return next;
                                });
                              }}
                            >
                              <strong>{acc.code}</strong> — {acc.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>


                      {/* Débito */}
                      <td className="border p-1 align-top text-right">
                        <input
                          type="number"
                          step="0.01"
                          className="w-full border rounded px-1 py-0.5 text-right text-xs md:text-sm"
                          value={
                            e.debit === undefined || e.debit === null
                              ? ""
                              : e.debit
                          }
                          onChange={(ev) =>
                            updateNumberField(i, "debit", ev.target.value)
                          }
                        />
                      </td>

                      {/* Crédit */}
                      <td className="border p-1 align-top text-right">
                        <input
                          type="number"
                          step="0.01"
                          className="w-full border rounded px-1 py-0.5 text-right text-xs md:text-sm"
                          value={
                            e.credit === undefined || e.credit === null
                              ? ""
                              : e.credit
                          }
                          onChange={(ev) =>
                            updateNumberField(i, "credit", ev.target.value)
                          }
                        />
                      </td>

                      {/* Remove líne */}
                      <td className="border p-1 text-center align-top">
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          className="text-red-600 hover:text-red-800 text-xs"
                          title="Eliminar línea"
                        >
                          ✖
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Totals row */}
                {localEntries.length > 0 && (
                  <tr className="bg-gray-100 font-semibold">
                    {/* Total Label */}
                    <td className="border px-8 py-2 text-right" colSpan={2}>
                      Totales:
                    </td>

                    {/* Total Debit */}
                    <td className="border px-6 py-2 text-right">
                      {totalDebit.toFixed(2)}
                    </td>

                    {/* Total Credit */}
                    <td className="border px-6 py-2 text-right">
                      {totalCredit.toFixed(2)}
                    </td>

                    {/* Emty cell for UI */}
                    <td className="border" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Note + balance message */}
          <div className="mt-4 flex items-center gap-3">
            <label className="text-sm font-medium whitespace-nowrap">
              Nota / Glosa:
            </label>

            <input
              type="text"
              className="flex-1 border rounded px-3 py-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Factura 001-001-000123456, almuerzo cliente XYZ"
            />

            <div className="text-xs md:text-sm whitespace-nowrap ml-2">
              {isBalanced ? (
                <span className="text-green-600 font-semibold">
                  ✔ Asiento balanceado
                </span>
              ) : (
                <span className="text-red-600 font-semibold">
                  ⚠ No balanceado (D - C = {diff.toFixed(2)})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t rounded-b-xl flex justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 text-sm font-medium"
          >
            Cancelar
          </button>

          <button
            disabled={!isBalanced}
            onClick={handleSave}
            className={`px-4 py-2 rounded text-sm font-medium text-white ${
              isBalanced
                ? "bg-green-600 hover:bg-green-700"
                : "bg-green-600/50 cursor-not-allowed"
            }`}
          >
            Confirmar Asiento
          </button>
        </div>
      </Rnd>
    </div>
  );
}