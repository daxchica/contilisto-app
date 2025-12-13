// ============================================================================
// src/components/JournalPreviewModal.tsx
// CONTILISTO ARCHITECTURE v1.0
//
// - Recibe asientos ya construidos por el backend (OCR + IA).
// - Permite revisar y ajustar cuentas, débitos, créditos y glosa.
// - Valida que el asiento esté balanceado.
// - SOLO permite seleccionar cuentas hoja (último nivel).
// - Aprende por proveedor qué cuenta de gasto se usa más (accountHints).
// ============================================================================

import React, { useState, useEffect, useMemo } from "react";
import { Rnd } from "react-rnd";
import type { Account } from "../../types/AccountTypes";
import type { JournalEntry } from "../../types/JournalEntry";
import {
  fetchAccountHintsBySupplierRUC,
  saveAccountHint,
} from "@/services/accountHintService";

interface Props {
  entries: JournalEntry[];
  metadata: any;
  accounts: Account[];
  entityId: string;
  userId: string;
  onClose: () => void;
  onSave: (entries: JournalEntry[], note: string) => Promise<void>;
}

// Local entry with UI flags
type LocalEntry = JournalEntry & {
  showPicker?: boolean; // kept for compatibility, but main control is activePickerIndex
};

type Suggestion = {
  code: string;
  name: string;
  isHint: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True si la cuenta es "hoja" (no tiene hijos). */
function isLeafAccount(account: Account, all: Account[]): boolean {
  // 1) Regla directa: si account trae explicitamente lastLevel marcamos hoja
  if ((account as any).isLastLevel === true) return true;

  // 2) Standard del PUC ecuatoriano: longitud >= 9 dígitos ya es subcuenta real
  if (account.code.length >= 9) return true;

  // 3) Si aún así tiene hijas reales → no la consideramos hoja
  return !all.some(
    (other) =>
      other.code !== account.code && other.code.startsWith(account.code)
  );
}

/** Normaliza texto para búsqueda (minúsculas, sin tildes, sin signos). */
function normalize(text: string | undefined | null): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

// Stopwords para mejorar matching semántico
const STOPWORDS = ["en", "de", "la", "el", "por", "los", "las", "del", "para"];

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
  const [localEntries, setLocalEntries] = useState<LocalEntry[]>([]);
  const [note, setNote] = useState<string>("");
  const [hints, setHints] = useState<{ code: string; name: string }[]>([]);
  const [activePickerIndex, setActivePickerIndex] = useState<number | null>(
    null
  );

  // Solo cuentas hoja + TODAS las cuentas que la IA ya usó en los asientos
  const leafAccounts = useMemo(() => {
    // 1) Hojas "normales" del plan de cuentas que llega por props
    const baseLeaves = accounts.filter((acc) => isLeafAccount(acc, accounts));

    // 2) Códigos que vienen en los asientos (IA)
    const fromEntriesCodes = Array.from(
      new Set(
        (entries || [])
          .map((e) => (e.account_code || "").trim())
          .filter(Boolean)
      )
    );

    const fromEntries: Account[] = fromEntriesCodes.map((code) => {
      const existing = accounts.find((a) => a.code === code);
      if (existing) return existing;

      // Si el código no existe en `accounts`, construimos una cuenta "fantasma"
      const entry = (entries || []).find(
        (e) => (e.account_code || "").trim() === code
      );
      const name =
        (entry?.account_name && entry.account_name.trim()) || `Cuenta ${code}`;

      return {
        code,
        name,
        isLastLevel: true, // la tratamos como hoja
      } as any as Account;

    });
    
    // 3) Unimos y eliminamos duplicados por código
    const merged = [...baseLeaves, ...fromEntries];
    const map = new Map<string, Account>();
    for (const acc of merged) {
      map.set(acc.code, acc);
    }
    return Array.from(map.values());
  }, [accounts, entries]);

  // Cuentas disponibles para el buscador (todas las hojas del plan)
  const availableAccounts = useMemo(() => {
    return accounts.filter((acc) => isLeafAccount(acc, accounts));
  }, [accounts]);

  // --------------------------------------------------------------------------
  // Inicialización: asientos + glosa + hints por proveedor
  // --------------------------------------------------------------------------
  useEffect(() => {
    // 1) Clonar asientos
    const cloned: LocalEntry[] = (entries || []).map((e) => ({ ...e }));
    const withIds = cloned.map((e) => ({
      ...e,
      id: e.id || crypto.randomUUID(),
      showPicker: false,
    }));
    setLocalEntries(withIds);

    // 2) Glosa por defecto
    const mainExpense = entries.find(
      (e) =>
        typeof e.account_code === "string" &&
        e.account_code.trim().startsWith("5")
    );
    const expenseDescription = mainExpense?.account_name?.trim() || "";

    const invoiceNumber =
      metadata?.invoice_number || entries?.[0]?.invoice_number || "";

    const glosa =
      invoiceNumber && expenseDescription
        ? `Factura ${invoiceNumber} - ${expenseDescription}`
        : invoiceNumber
        ? `Factura ${invoiceNumber}`
        : expenseDescription;

    setNote((prev) => (prev ? prev : glosa || ""));

    // 3) Cargar hints de Firestore por proveedor
    async function loadHints() {
      const supplierRUC = metadata?.issuerRUC;
      if (!supplierRUC) return;

      const data = await fetchAccountHintsBySupplierRUC(supplierRUC);

      // 1) Mapeo básico desde Firestore
      const mappedRaw = data.map((h: any) => ({
        code: h.accountCode as string,
        name: h.accountName as string,
      }));

      // 2) Si existe esa cuenta en el PUC, usamos SU nombre
      const mapped = mappedRaw.map((h) => {
        const coa = leafAccounts.find((acc) => acc.code === h.code);
        return {
          code: h.code,
          name: coa?.name ?? h.name,
        };
      });

      // 3) Preferimos el grupo 5xx del asiento actual si existe
      const preferredExpense = entries.find(
        (e) => e.account_code && e.account_code.startsWith("5")
      );

      if (preferredExpense?.account_code) {
        const prefix = preferredExpense.account_code.slice(0, 3); // ej. "502"
        const filtered = mapped.filter((h) => h.code.startsWith(prefix));
        setHints(filtered.length > 0 ? filtered : mapped);
      } else {
        setHints(mapped);
      }
    }

    loadHints().catch((err) =>
      console.error("Error cargando accountHints:", err)
    );
  }, [entries, metadata, leafAccounts]);

  // --------------------------------------------------------------------------
  // Totales y balance
  // --------------------------------------------------------------------------
  const { totalDebit, totalCredit, isBalanced, diff } = useMemo(() => {
    const d = localEntries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0);
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
  // Helpers de edición
  // --------------------------------------------------------------------------
  function patchEntry(index: number, patch: Partial<LocalEntry>) {
    setLocalEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

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

  function handleCodeChange(index: number, rawCode: string) {
    patchEntry(index, {
      account_code: rawCode,
    });
  }

  function handleCodeBlur(index: number) {
    // Validar / completar código sin cerrar forzadamente el picker
    setLocalEntries((prev) => {
      const next = [...prev];
      const entry = next[index];
      const raw = (entry.account_code || "").trim();

      if (!raw) {
        entry.account_code = "";
        entry.account_name = "";
        return next;
      }

      // 1) Exact match
      const exact = leafAccounts.find((a) => a.code === raw);
      if (exact) {
        entry.account_code = exact.code;
        entry.account_name = exact.name;
        return next;
      }

      // 2) Partial match único
      const partials = leafAccounts.filter((a) => a.code.startsWith(raw));
      if (partials.length === 1) {
        entry.account_code = partials[0].code;
        entry.account_name = partials[0].name;
        return next;
      }

      // 3) Dejar que el usuario elija en el picker
      return next;
    });
  }

  function handleNameChange(index: number, value: string) {
    patchEntry(index, {
      account_name: value,
    });
  }

  function removeLine(index: number) {
    setLocalEntries((prev) => prev.filter((_, i) => i !== index));
    setActivePickerIndex((current) =>
      current === index
        ? null
        : current !== null && current > index
        ? current - 1
        : current
    );
  }

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
        type: "expense",
        invoice_number:
          metadata?.invoice_number || prev[0]?.invoice_number || "",
        issuerRUC: metadata?.issuerRUC || prev[0]?.issuerRUC || "",
        issuerName: metadata?.issuerName || "",
        supplier_name: metadata?.supplier_name || "",
        invoiceDate: metadata?.invoiceDate || prev[0]?.invoiceDate || today,
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

    function isLeafCode(code: string) {
      const trimmed = code.trim();
      return leafAccounts.some((acc) => acc.code === trimmed);
    }

    const invalidLines = localEntries.filter(
      (e) => !e.account_code || !isLeafCode(e.account_code)
    );

    if (invalidLines.length > 0) {
      alert(
        "⚠ Solo se permiten cuentas de último nivel (hoja). Verifica que los códigos no tengan cuentas hijas o inexistentes."
      );
      return;
    }

    try {
      const supplierRUC =
        metadata?.issuerRUC || localEntries[0]?.issuerRUC || "";

      if (supplierRUC) {
        for (const line of localEntries) {
          if (line.account_code?.startsWith("5")) {
            await saveAccountHint({
              supplierRUC,
              accountCode: line.account_code,
              accountName: line.account_name,
              userId,
            });
          }
        }
      }

      // 2) Normalizamos ANTES de enviar al padre
      const fixedEntries: JournalEntry[] = localEntries.map((e) => ({
        ...e,
        entityId,
        uid: userId,
        userId,
        description: note,
        source: e.source ?? "edited",
        createdAt: e.createdAt ?? Date.now(),
      }));

      await onSave(fixedEntries, note || "");
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
        default={{ x: 100, y: 40, width: 900, height: 600 }}
        minWidth={800}
        minHeight={480}
        disableDragging={false}
        enableResizing={false}
        dragHandleClassName="drag-header"
        className="bg-white rounded-xl shadow-2xl flex flex-col overflow-visible"
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
        <div className="flex-1 p-6 overflow-visible">
          {/* METADATA FACTURA */}
          {metadata && (
            <div className="mb-4 p-3 bg-gray-100 rounded text-sm grid grid-cols-1 md:grid-cols-2 gap-2">
              <p>
                <strong>Proveedor:</strong> {metadata.issuerName || "—"}
              </p>
              <p>
                <strong>RUC Proveedor:</strong> {metadata.issuerRUC || "—"}
              </p>
              <p>
                <strong>Factura Nº:</strong> {metadata.invoice_number || "—"}
              </p>
              <p>
                <strong>Fecha factura:</strong> {metadata.invoiceDate || "—"}
              </p>
              <p>
                <strong>Subtotal IVA:</strong>{" "}
                {metadata.subtotal15 ?? metadata.subtotal12 ?? 0}
              </p>
              <p>
                <strong>Subtotal 0%:</strong> {metadata.subtotal0 ?? 0}
              </p>
              <p>
                <strong>IVA:</strong> {metadata.iva ?? 0}
              </p>
              <p>
                <strong>Total:</strong> {metadata.total ?? 0}
              </p>
            </div>
          )}

          {/* FECHA GLOBAL + BOTÓN AGREGAR LÍNEA */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="block text-sm font-medium mb-1">
                Fecha del asiento:
              </label>
              <input
                type="date"
                className="border rounded px-3 py-2 text-sm"
                value={localEntries[0]?.date || ""}
                onChange={(ev) => {
                  const newDate = ev.target.value;
                  setLocalEntries((prev) =>
                    prev.map((e) => ({
                      ...e,
                      date: newDate,
                    }))
                  );
                }}
              />
            </div>

            <button
              type="button"
              onClick={addEmptyLine}
              className="px-3 py-1.5 text-xs md:text-sm bg-blue-50 text-blue-700 rounded border border-blue-300 hover:bg-blue-100"
            >
              ➕ Agregar línea
            </button>
          </div>

          {/* TABLA DE ASIENTOS */}
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
                  const codeQuery = normalize(e.account_code);
                  const nameQuery = normalize(e.account_name);
                  const query = nameQuery || codeQuery;

                  const isExpenseRow =
                    (e.account_code || "").startsWith("5") ||
                    normalize(e.account_name).includes("gasto");

                  // 1) Lista base filtrada por query
                  const filteredBase = query
                    ? availableAccounts.filter((acc) => {
                        const target =
                          normalize(acc.name) + " " + normalize(acc.code);

                        const qWords = query
                          .split(" ")
                          .map((w) => w.trim())
                          .filter(
                            (w) =>
                              w.length >= 2 &&
                              !STOPWORDS.includes(w.toLowerCase())
                          );

                        if (qWords.length === 0) return true;
                        return qWords.every((word) => target.includes(word));
                      })
                    : availableAccounts;

                  // 2) Hints por proveedor primero (si coincide con query)
                  const hintSet = new Set<string>();
                  const suggestionsFromHints: Suggestion[] =
                    isExpenseRow && hints.length > 0
                      ? hints
                          .filter((h) => {
                            if (!query) return true;
                            const target =
                              normalize(h.name) + " " + normalize(h.code);
                            return target.includes(query);
                          })
                          .map((h) => {
                            hintSet.add(h.code);
                            return {
                              code: h.code,
                              name: h.name,
                              isHint: true,
                            };
                          })
                      : [];

                  // 3) Resto de cuentas
                  const suggestionsFromAccounts: Suggestion[] =
                    filteredBase
                      .filter((acc) => !hintSet.has(acc.code))
                      .map((acc) => ({
                        code: acc.code,
                        name: acc.name,
                        isHint: false,
                      }));

                  const suggestions: Suggestion[] = [
                    ...suggestionsFromHints,
                    ...suggestionsFromAccounts,
                  ];

                  const isOpen = activePickerIndex === i;

                  return (
                    <tr
                      key={e.id || i}
                      className="odd:bg-white even:bg-gray-50"
                    >
                      {/* Código */}
                      <td className="border p-1 align-top">
                        <input
                          type="text"
                          className="w-full border rounded px-1 py-0.5 text-xs md:text-sm"
                          value={e.account_code || ""}
                          onChange={(ev) => {
                            handleCodeChange(i, ev.target.value);
                          }}
                          onBlur={() => handleCodeBlur(i)}
                          onFocus={() => setActivePickerIndex(i)}
                        />
                      </td>

                      {/* Nombre de cuenta + dropdown */}
                      <td
                        className="border p-1 align-top relative w-80 max-w-xs"
                        style={{ position: "relative", zIndex: 999999 }}
                      >
                        <div className="relative">
                          <input
                            type="text"
                            className="w-full border rounded px-1 py-0.5 text-xs md:text-sm"
                            value={e.account_name || ""}
                            onChange={(ev) => {
                              const value = ev.target.value;
                              handleNameChange(i, value);
                              setActivePickerIndex(i);
                            }}
                            onFocus={() => {
                              setActivePickerIndex(i);
                            }}
                            onBlur={(ev) => {
                              const target =
                                ev.relatedTarget as HTMLElement | null;

                              // Si el blur viene de hacer click en una opción, no cerramos
                              if (
                                target &&
                                target.dataset?.accountOption === "1"
                              ) {
                                return;
                              }

                              setActivePickerIndex(null);
                            }}
                          />

                          {isOpen && suggestions.length > 0 && (
                            <div
                              className="absolute left-0 mt-1  w-full max-h-[350px] overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-2xl z-[9999] text-xs md:text-sm"
                              style={{ top: "100%", position: "fixed" }}
                            >
                              {suggestions.map((acc) => (
                                <div
                                  key={acc.code}
                                  data-account-option="1"
                                  className={`px-2 py-1 cursor-pointer text-xs ${
                                    acc.isHint
                                      ? "bg-yellow-50 hover:bg-yellow-100 border-l-4 border-yellow-500"
                                      : "hover:bg-blue-100"
                                  }`}
                                  onMouseDown={(ev) => {
                                    // evitar blur antes de seleccionar
                                    ev.preventDefault();
                                  }}
                                  onClick={() => {
                                    setLocalEntries((prev) => {
                                      const next = [...prev];
                                      next[i].account_code = acc.code;
                                      next[i].account_name = acc.name;
                                      next[i].showPicker = false;
                                      return next;
                                    });
                                    setActivePickerIndex(null);
                                  }}
                                >
                                  <strong>{acc.code}</strong> — {acc.name}
                                  {acc.isHint && (
                                    <span className="text-yellow-700 ml-2 italic">
                                      (Recomendado)
                                    </span>
                                  )}
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

                      {/* Crédito */}
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

                      {/* Eliminar línea */}
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

                {localEntries.length > 0 && (
                  <tr className="bg-gray-100 font-semibold">
                    <td className="border px-8 py-2 text-right" colSpan={2}>
                      Totales:
                    </td>
                    <td className="border px-6 py-2 text-right">
                      {totalDebit.toFixed(2)}
                    </td>
                    <td className="border px-6 py-2 text-right">
                      {totalCredit.toFixed(2)}
                    </td>
                    <td className="border" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* GLOSA + ESTADO DE BALANCE */}
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