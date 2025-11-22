// ============================================================================
// src/components/JournalPreviewModal.tsx
// ARQUITECTURA CONTILISTO v1.0
//
// Rol de este componente:
// - Recibir entries ya construidos por el backend (OCR + Vision + Prompt).
// - Mostrar los datos clave de la factura (metadata).
// - Permitir al usuario revisar y AJUSTAR:
//     • Código de cuenta
//     • Nombre de cuenta
//     • Descripción
//     • Débito / Crédito
// - Validar que el asiento esté balanceado.
// - Enviar entries + nota al padre mediante onSave().
//
// IMPORTANTE ACv1:
// - Aquí NO volvemos a clasificar ni a reconstruir el asiento desde cero.
// - La lógica contable vive en el backend (extract-invoice-vision.ts).
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

// ============================================================================
// Utilidad: buscar cuenta por código (para futuras mejoras)
// ============================================================================
function findAccountByCode(accounts: Account[], code: string): Account | null {
  if (!code) return null;
  return accounts.find((a) => a.code === code) || null;
}

// ============================================================================
// COMPONENTE PRINCIPAL
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
  // Copia editable local de los asientos
  const [localEntries, setLocalEntries] = useState<LocalEntry[]>([]);
  const [note, setNote] = useState<string>("");

  // --------------------------------------------------------------------------
  // Inicialización: usamos SIEMPRE los entries que vienen del backend.
  // metadata se usa solo para la cabecera y para prellenar la nota.
  // --------------------------------------------------------------------------
  useEffect(() => {
    // 1. Clonamos los asientos para no mutar la prop original
    const cloned: LocalEntry[] = (entries || []).map((e) => ({ ...e }));

    // Aseguramos que cada línea tenga un id único (por si acaso)
    const withIds = cloned.map((e) => ({
      ...e,
      id: e.id || crypto.randomUUID(),
      showPicker: false,
    }));

    setLocalEntries(withIds);

    // 2. Seleccionar SOLO el gasto principal:
    //    - Cuenta cuyo código empieza en "5"
    //    - Si hay varias, tomamos la primera

    const gastoPrincipal = entries.find(
      (e) =>
        typeof e.account_code === "string" &&
        e.account_code.trim().startsWith("5")
    );

    // 3. Preparar texto del gasto (si existe)
    const descripcionGasto =
      gastoPrincipal?.account_name?.trim() || "";
    
    // 4. Obtener numero de factura
    const invoiceNumber =
      metadata?.invoice_number ||
      entries?.[0]?.invoice_number ||
      "";
    
    // 5. Construir glosa final
    const glosa = 
      invoiceNumber && descripcionGasto 
        ? `Factura ${invoiceNumber} - ${descripcionGasto}` 
        : invoiceNumber
        ? `Factura ${invoiceNumber}`
        : descripcionGasto;

    if (!note) setNote(glosa || "");
  }, [entries, metadata]);

  // --------------------------------------------------------------------------
  // Totales y balance
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
  // Handlers de edición
  // --------------------------------------------------------------------------

  // Cambiar campo genérico de texto (descripción, código, nombre de cuenta, etc.)
  function updateTextField(
    index: number,
    field: keyof LocalEntry,
    value: string
  ) {
    setLocalEntries((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  }

  // Cambiar campo numérico (debit / credit)
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

  // (Opcional futuro) sin usar aún, pero preparado para AccountSearchInput
  function updateAccountByCode( index: number, code: string) {
    const acc = findAccountByCode(accounts, code);
    setLocalEntries((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        account_code: code,
        account_name: acc?.name || next[index].account_name,
      };
      return next;
    });
  }

  // Eliminar una línea (por ejemplo, si la IA agregó algo extra)
  function removeLine(index: number) {
    setLocalEntries((prev) => prev.filter((_, i) => i !== index));
  }

  // Agregar una nueva línea vacía
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

          {/* FECHA GENERAL DEL ASIENTO */}
          <div className="mb-4 flex items-center justify-between gap-4">
            {/* Etiqueta + Input fecha */}
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
            
            {/* Botón para agregar línea */}
              <button
                type="button"
                onClick={addEmptyLine}
                className="px-3 py-1.5 text-xs md:text-sm bg-blue-50 text-blue-700 rounded border border-blue-300 hover:bg-blue-100"
              >
                ➕ Agregar línea
              </button>
          </div>

          {/* TABLA DE ASIENTOS */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs md:text-sm">
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
                {localEntries.map((e, i) => (
                  <tr key={e.id || i} className="odd:bg-white even:bg-gray-50">

                    {/* Código de cuenta */}
                    <td className="border p-1 align-top">
                      <input
                        type="text"
                        className="w-full border rounded px-1 py-0.5 text-xs md:text-sm"
                        value={e.account_code || ""}
                        onChange={(ev) =>
                          updateAccountByCode(i, ev.target.value)
                        }
                      />
                    </td>

                    {/* Nombre de cuenta */}
                    <td className="border p-1 align-top relative">
                      <div className="relative">
                      <input
                        type="text"
                        className="w-full border rounded px-1 py-0.5 text-xs md:text-sm"
                        value={e.account_name || ""}
                        onChange={(ev) => 
                          updateTextField( 
                            i, 
                            "account_name", 
                            ev.target.value
                          )
                        }
                        onFocus={() => 
                          setLocalEntries(prev => {
                            const next = [...prev];
                            next[i] = { ...next[i], showPicker: true };
                            return next;
                          })
                        }
                      />

                      {/* DROPDOWN */}
                      {e.showPicker && (
                        <div
                          className="absolute z-50 mt-1 w-full bg-white border rounded shadow-lg max-h-40 overflow-y-auto"
                          onMouseLeave={() =>
                            setLocalEntries(prev => {
                              const next = [...prev];
                              next[i] = { ...next[i], showPicker: false };
                              return next;
                            })
                          }
                        >
                          {accounts.map((acc) => (
                            <div
                              key={acc.code}
                              className="px-2 py-1 cursor-pointer hover:bg-blue-100 text-xs"
                              onClick={() => {
                                updateTextField(i, "account_name", acc.name);
                                updateTextField(i, "account_code", acc.code);

                                setLocalEntries(prev => {
                                  const next = [...prev];
                                  next[i].showPicker = true;
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
                ))}

                {/* Fila de totales */}
                {localEntries.length > 0 && (
                  <tr className="bg-gray-100 font-semibold">
                    {/* Etiqueta Totales */}
                    <td className="border px-8 text-right" colSpan={3}>
                      Totales:
                    </td>

                    {/* Total Debito */}
                    <td className="border px-6 text-right">
                      {totalDebit.toFixed(2)}
                    </td>

                    {/* Total Credito */}
                    <td className="border px-6 text-right">
                      {totalCredit.toFixed(2)}
                    </td>

                    {/* Celda vacía para mantener alineación */}
                    <td className="border px-3 py-1" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Nota + Input + Mensaje balanceado en una sola linea */}
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