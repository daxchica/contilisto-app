// ============================================================================
// src/components/ManualBalanceForm.tsx
// Carga manual del Balance Inicial — versión corregida con CLICK OUTSIDE
// ============================================================================

import React, {
  useState,
  useMemo,
  useEffect,
  useRef
} from "react";

import type { Account } from "../types/AccountTypes";
import { saveInitialBalances } from "../services/initialBalanceService";

export interface Entry {
  id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  date: string;
}

interface Props {
  onSubmit: (entries: Entry[]) => void;
  entityId: string;
  accounts: Account[];
}

// Normaliza texto para búsqueda
const normalize = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Ranking de coincidencias
function scoreMatch(target: string, query: string): number {
  const q = normalize(query || "").trim();
  if (!q) return 0;

  const t = normalize(target || "");
  if (!t) return 0;
  
  if (t === q) return 120;
  if (t.startsWith(q)) return 100;
  if (t.includes(` ${q}`)) return 80;
  if (t.includes(q)) return 60;
  return 0;
}

export default function ManualBalanceForm({
  onSubmit,
  entityId,
  accounts,
}: Props) {
  const [rows, setRows] = useState<Entry[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // ref para detectar click outside
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // ===================== CLICK OUTSIDE HANDLER =====================
  useEffect(() => {
    function handleClickOutside(ev: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(ev.target as Node)
      ) {
        setOpenIndex(null); // cerrar dropdown
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ========================== Add Row ==============================
  const addEmptyLine = () => {
    setRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        account_code: "",
        account_name: "",
        debit: 0,
        credit: 0,
        date: new Date().toISOString().slice(0, 10),
      },
    ]);
  };

  const removeLine = (id: string) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  const updateField = (
    index: number,
    field: keyof Entry,
    value: string | number
  ) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // ===================== Totales ============================
  const { totalDebit, totalCredit, isBalanced, diff } = useMemo(() => {
    const d = rows.reduce((s, r) => s + (r.debit || 0), 0);
    const c = rows.reduce((s, r) => s + (r.credit || 0), 0);

    return {
      totalDebit: d,
      totalCredit: c,
      isBalanced: Math.abs(d - c) < 0.001,
      diff: d - c,
    };
  }, [rows]);

  // ===================== Guardar ============================
  const handleSave = async () => {
    if (!isBalanced) {
      alert(`⚠ El Balance Inicial NO cuadra (D - C = ${diff.toFixed(2)})`);
      return;
    }

    if (rows.length === 0) {
      alert("No hay lineas en el Balance Inicial.");
      return;
    }

    try {
      await saveInitialBalances(
        entityId,
        rows.map((r) => ({
          account_code: r.account_code,
          account_name: r.account_name,
          initial_balance: (r.debit || 0) - (r.credit || 0),
        }))
      );

      alert("✔ Balance Inicial guardado.");
      onSubmit(rows);
    } catch (err) {
      console.error(err);
      alert("❌ Error guardando Balance Inicial.");
    }
  };

  // ===================== RENDER ============================
  return (
    <div className="p-4 border rounded mb-4 relative">
      <h3 className="font-semibold mb-2">Carga Manual del Balance Inicial</h3>

      <button
        type="button"
        className="mb-4 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={addEmptyLine}
      >
        ➕ Agregar Línea
      </button>

      <div className="border rounded-lg relative">
        <table className="w-full text-xs md:text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 border">Código</th>
              <th className="p-2 border">Cuenta</th>
              <th className="p-2 border text-right w-24">Débito</th>
              <th className="p-2 border text-right w-24">Crédito</th>
              <th className="p-2 border w-8">✂</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => {
              const query = (row.account_name || row.account_code || "").trim();

              // ===================== Sugerencias ordenadas =====================
              const suggestions = 
                query.length === 0
                  ? accounts.slice(0, 20)
                  : accounts
                    .map((acc) => ({
                      ...acc,
                      score:
                        scoreMatch(acc.code, query) +
                        scoreMatch(acc.name, query),
                }))
                .filter((acc) => acc.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 20);

              return (
                <tr key={row.id} className="odd:bg-white even:bg-gray-50">
                  {/* =================== Código =================== */}
                  <td className="border p-1">
                    <input
                      type="text"
                      value={row.account_code}
                      className="w-full border rounded px-1 py-0.5"
                      onFocus={() => setOpenIndex(i)}
                      onChange={(e) =>
                        updateField(i, "account_code", e.target.value)
                      }
                    />
                  </td>

                  {/* =================== Nombre de cuenta =================== */}
                  <td className="border p-1 relative">
                    <input
                      type="text"
                      value={row.account_name}
                      className="w-full border rounded px-1 py-0.5"
                      onFocus={() => setOpenIndex(i)}
                      onChange={(e) =>
                        updateField(i, "account_name", e.target.value)
                      }
                    />

                    {/* =================== DROPDOWN (PORTAL SIMPLIFICADO) =================== */}
                    {openIndex === i && suggestions.length > 0 && (
                      <div
                        ref={dropdownRef}
                        className="
                          absolute
                          left-0
                          right-0
                          mt-1
                          bg-white 
                          border 
                          rounded 
                          shadow-xl 
                          z-50
                          max-h-56 
                          overflow-y-auto 
                          text-xs
                        "
                      >
                        {suggestions.map((acc) => (
                          <div
                            key={acc.code}
                            className="px-3 py-2 cursor-pointer hover:bg-blue-100"
                            onMouseDown={() => {
                              updateField(i, "account_code", acc.code);
                              updateField(i, "account_name", acc.name);
                              setOpenIndex(null);
                            }}
                          >
                            <strong>{acc.code}</strong> — {acc.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* =================== Débito =================== */}
                  <td className="border p-1 text-right">
                    <input
                      type="number"
                      value={row.debit}
                      className="w-full border rounded px-1 py-0.5 text-right"
                      onChange={(e) =>
                        updateField(i, "debit", Number(e.target.value) || 0)
                      }
                    />
                  </td>

                  {/* =================== Crédito =================== */}
                  <td className="border p-1 text-right">
                    <input
                      type="number"
                      value={row.credit}
                      className="w-full border rounded px-1 py-0.5 text-right"
                      onChange={(e) =>
                        updateField(i, "credit", Number(e.target.value))
                      }
                    />
                  </td>

                  {/* =================== Delete =================== */}
                  <td className="border p-1 text-center">
                    <button
                      className="text-red-600 hover:text-red-800"
                      onClick={() => removeLine(row.id)}
                    >
                      ✖
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* =================== Totales =================== */}
            {rows.length > 0 && (
              <tr className="bg-gray-100 font-semibold">
                <td className="border p-2 text-right" colSpan={2}>
                  Totales:
                </td>
                <td className="border p-2 text-right">
                  {totalDebit.toFixed(2)}
                </td>
                <td className="border p-2 text-right">
                  {totalCredit.toFixed(2)}
                </td>
                <td className="border" />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* =================== Botón Guardar =================== */}
      <div className="mt-4 flex justify-end">
        <button
          className={`px-4 py-2 rounded text-white ${
            isBalanced
              ? "bg-green-600 hover:bg-green-700"
              : "bg-green-600/40 cursor-not-allowed"
          }`}
          disabled={!isBalanced}
          onClick={handleSave}
        >
          Confirmar Balance Inicial
        </button>
      </div>

      {/* =================== Estado balanceado =================== */}
      <div className="mt-2 text-sm">
        {isBalanced ? (
          <span className="text-green-700">✔ Balanceado</span>
        ) : (
          <span className="text-red-600">
            ⚠ No balanceado (D - C = {diff.toFixed(2)})
          </span>
        )}
      </div>
    </div>
  );
}