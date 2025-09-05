// src/components/JournalPreviewModal.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import type { Account } from "../types/AccountTypes";
import type { JournalEntry } from "../types/JournalEntry";
import AccountPicker from "./AccountPicker";
import { saveAccountHint } from "../services/aiLearningService";


// 👇 Usamos el PUC unificado
import {
  canonicalCodeFrom,
  canonicalPair,
  normalizeEntry,
  getAccountsForUI,
} from "../utils/accountPUCMap";

/* ====================== Types ====================== */
interface Props {
  entries: JournalEntry[];
  accounts: Account[]; // Catálogo canónico (7 dígitos) que alimenta los selects
  entityId: string;
  userId: string;
  onCancel: () => void;
  onSave: (confirmed: JournalEntry[]) => void;
}

type Row = JournalEntry & { _rid: string };

/* ====================== Helpers ====================== */
const normKey = (s?: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

function extractLeadingCodeFromLabel(label?: string): string | null {
  if (!label) return null;
  // “60601 — Compras …” ó “60601 - …”
  const m = label.trim().match(/^(\d{2,})\s*[—-]\s*/);
  return m ? m[1] : null;
}

function toNum(n: unknown): number | undefined {
  const v = typeof n === "string" ? Number.parseFloat(n) : (n as number | undefined);
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function rid() {
  if (typeof crypto?.getRandomValues === "function") {
    const a = new Uint32Array(2);
    crypto.getRandomValues(a);
    return `${a[0].toString(36)}-${a[1].toString(36)}`;
  }
  return Math.random().toString(36).slice(2);
}

/* ====================== Component ====================== */
export default function JournalPreviewModal({
  entries,
  accounts,
  entityId,
  userId,
  onCancel,
  onSave,
}: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [note, setNote] = useState<string>("");

  /* --------- Indexes para resolución código<->nombre --------- */
  const codeToName = useMemo(() => {
    const m = new Map<string, string>();
    accounts.forEach((a) => m.set(a.code, a.name));
    return m;
  }, [accounts]);

  // Usa el resolutor canónico (alias + 5→7) para obtener código desde un nombre/etiqueta
  const inferCodeFromName = (name?: string): string | "" => {
    if (!name) return "";
    const fromLabel = extractLeadingCodeFromLabel(name);
    const candidate = fromLabel || name;
    return canonicalCodeFrom(candidate) || "";
  };

  /* --------- Carga inicial + auto-fixes + normalización IA --------- */
  useEffect(() => {
    const updated: Row[] = entries.map((e) => {
      let u: JournalEntry = { ...e };

      // Auto-fixes de negocio (si aplican a tus flujos)
      if (u.type === "income" && u.account_code === "11101" && u.account_name === "Caja") {
        u.account_code = "14301";
        u.account_name = "Cuentas por cobrar comerciales locales";
        u.description = "Cuenta por cobrar por factura de venta";
      }

      if (u.type === "income" && u.account_code === "70101" && (u.debit ?? 0) > 0) {
        u.credit = u.debit;
        u.debit = undefined;
      }

      // 🔒 Normalización fuerte a PUC canónico (maneja 5→7, alias, etc.)
      u = normalizeEntry(u);

      // Completar código si vino sólo el nombre (post-normalización)
      if (!u.account_code && u.account_name) {
        const code = inferCodeFromName(u.account_name);
        if (code) {
          u.account_code = code;
          u.account_name = codeToName.get(code) || u.account_name;
        }
      }

      // Completar nombre si vino sólo el código
      if (u.account_code && !u.account_name) {
        const nm = codeToName.get(u.account_code);
        if (nm) u.account_name = nm;
      }

      return {
        ...u,
        source: u.source ?? "ai",
        _rid: rid(),
      };
    });

    setRows(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, codeToName]);

  /* --------- Rehidratación si cambia PUC --------- */
  useEffect(() => {
    if (rows.length === 0) return;

    setRows((prev) =>
      prev.map((r) => {
        // Vuelve a canónizar por si cambió el catálogo/alias
        const n = normalizeEntry({ account_code: r.account_code, account_name: r.account_name });

        let out = { ...r, account_code: n.account_code, account_name: n.account_name };

        // Hidratar faltantes contra catálogo
        if (!out.account_code && out.account_name) {
          const code = inferCodeFromName(out.account_name);
          if (code) {
            out.account_code = code;
            out.account_name = codeToName.get(code) || out.account_name;
          }
        }
        if (out.account_code && !out.account_name) {
          const nm = codeToName.get(out.account_code);
          if (nm) out.account_name = nm;
        }
        return out;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]); // ← rehidrata sólo cuando cambian las cuentas

  /* -------------------- Totales -------------------- */
  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + (toNum(r.debit) ?? 0), 0);
    const credit = rows.reduce((s, r) => s + (toNum(r.credit) ?? 0), 0);
    const diff = +(debit - credit).toFixed(2);
    return { debit: +debit.toFixed(2), credit: +credit.toFixed(2), diff };
  }, [rows]);

  const isBalanced = Math.abs(totals.diff) < 0.01;
  const canConfirm = totals.debit > 0 && totals.credit > 0 && isBalanced;

  /* -------------------- Edición -------------------- */
  const patchRow = (idx: number, patch: Partial<JournalEntry>) => {
    setRows((prev) => {
      const next = [...prev];
      const cur = next[idx];

      // Si el patch trae cuenta, normaliza antes de guardar
      const merged = { ...cur, ...patch };
      const canon = normalizeEntry({ account_code: merged.account_code, account_name: merged.account_name });

      next[idx] = {
        ...merged,
        account_code: canon.account_code,
        account_name: canon.account_name,
        manual: true,
        source: cur.source === "ai" ? "edited" : cur.source,
        editedAt: Date.now(),
        editedBy: userId,
      };
      return next;
    });
  };

  const setAmount = (idx: number, field: "debit" | "credit", raw: string) => {
    const val = raw.trim() === "" ? undefined : Number.parseFloat(raw);
    if (field === "debit") {
      patchRow(idx, { debit: Number.isFinite(val as number) ? (val as number) : undefined, credit: undefined });
    } else {
      patchRow(idx, { credit: Number.isFinite(val as number) ? (val as number) : undefined, debit: undefined });
    }
  };

  const applyCode = (idx: number, code: string) => {
    const name = codeToName.get(code) ?? "";
    patchRow(idx, { account_code: code || "", account_name: name || "" });
  };

  const applyAccount = (idx: number, acc: { code: string; name: string } | null) => {
    if (!acc) return;
    // Canoniza por si el picker trae label con código o nombre con alias
    const canon = canonicalPair(acc);
    patchRow(idx, { account_code: canon.code || "", account_name: canon.name || "" });
  };

  const insertLine = (after?: number) => {
    const base = rows[0] ?? entries[0];
    const nl: Row = {
      _rid: rid(),
      date: base?.date ?? new Date().toISOString().slice(0, 10),
      description: "",
      account_code: "",
      account_name: "",
      debit: undefined,
      credit: undefined,
      type: base?.type,
      invoice_number: base?.invoice_number,
      transactionId: base?.transactionId,
      userId,
      source: "manual",
      manual: true,
      createdAt: Date.now(),
    };
    setRows((prev) => {
      const next = [...prev];
      const pos = typeof after === "number" ? after + 1 : next.length;
      next.splice(pos, 0, nl);
      return next;
    });
    setSelectedIdx((after ?? rows.length - 1) + 1);
  };

  const duplicateSelected = () => {
    if (selectedIdx == null) return;
    const src = rows[selectedIdx];
    setRows((prev) => {
      const next = [...prev];
      next.splice(selectedIdx + 1, 0, {
        ...src,
        _rid: rid(),
        manual: true,
        source: "edited",
        editedAt: Date.now(),
        editedBy: userId,
      });
      return next;
    });
    setSelectedIdx(selectedIdx + 1);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    if (selectedIdx === idx) setSelectedIdx(null);
  };

  /* -------------------- Confirmar + “Aprendizaje” -------------------- */
  const learnFromEdits = async (confirmed: JournalEntry[]) => {
    const hints = confirmed.filter((r) => r.manual || r.source === "edited");
    await Promise.all(
      hints.map((h) =>
        saveAccountHint({
          entityId,
          userId,
          hintKey: h.counterpartyRUC || h.invoice_number || (h.description ?? "general"),
          account_code: h.account_code,
          account_name: h.account_name,
          type: h.type,
        }).catch(() => void 0)
      )
    );
  };

  const onConfirm = useCallback(async () => {
    if (!canConfirm) return;

    // Usa la nota como descripción en líneas vacías
    const withNote = rows.map<Row>((r) => ({
      ...r,
      description: r.description && r.description.trim() !== "" ? r.description : note || r.description,
      userId,
      editedAt: r.manual ? Date.now() : r.editedAt,
    }));

    await learnFromEdits(withNote);
    onSave(withNote);
  }, [rows, note, userId, canConfirm, onSave]);

  /* -------------------- UI -------------------- */
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-6">
      <div className="w-full max-w-6xl rounded-lg bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">🧾 Previsualización de Asientos Contables</h2>

          <div className="flex items-center gap-2">
            <button
              onClick={() => insertLine(selectedIdx ?? undefined)}
              className="rounded bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700"
              title="Agregar línea (debajo de la seleccionada)"
            >
              ➕ Agregar línea
            </button>
            <button
              onClick={duplicateSelected}
              disabled={selectedIdx == null}
              className="rounded bg-indigo-600 px-3 py-1 text-white enabled:hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="Duplicar fila seleccionada"
            >
              ⧉ Duplicar
            </button>
            <button
              onClick={() => (selectedIdx == null ? null : removeRow(selectedIdx))}
              disabled={selectedIdx == null}
              className="rounded bg-rose-600 px-3 py-1 text-white enabled:hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="Eliminar fila seleccionada"
            >
              ✖ Eliminar
            </button>
          </div>
        </div>

        {/* Nota */}
        <div className="mb-3">
          <input
            className="w-full rounded border px-3 py-3 text-slate-700"
            placeholder="Ej: Ajuste por depreciación, reclasificación, etc."
            aria-label="Anotación del asiento (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* Tabla */}
        <div className="max-h-[60vh] overflow-auto rounded border">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
              <tr className="border-b">
                <th className="border p-2 w-[220px]">Código</th>
                <th className="border p-2 min-w-[520px]">Cuenta</th>
                <th className="border p-2 text-right w-[140px]">Débito</th>
                <th className="border p-2 text-right w-[140px]">Crédito</th>
                <th className="border p-2 w-[60px]" aria-label="acciones" />
              </tr>
            </thead>

            <tbody>
              {rows.map((r, idx) => {
                const selected = selectedIdx === idx;
                // Siempre intenta tener el código canónico para el select
                const codeValue =
                  canonicalCodeFrom(r.account_code || r.account_name || "") ||
                  inferCodeFromName(r.account_name) ||
                  "";

                return (
                  <tr
                    key={r._rid}
                    className={`border-t ${selected ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                    onClick={() => setSelectedIdx(idx)}
                  >
                    {/* CÓDIGO */}
                    <td className="border p-2">
                      <select
                        className="w-full rounded border px-2 py-2"
                        value={codeValue}
                        onChange={(e) => applyCode(idx, e.target.value)}
                      >
                        <option value="">-- Seleccionar --</option>
                        {accounts.map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.code}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* CUENTA */}
                    <td className="border p-2">
                      <AccountPicker
                        accounts={accounts}
                        value={codeValue ? { code: codeValue, name: codeToName.get(codeValue) ?? r.account_name } : null}
                        onChange={(acc) => applyAccount(idx, acc)}
                        placeholder="Buscar cuenta por nombre o código…"
                        displayMode="name"
                        inputClassName="w-full rounded border px-2 py-2"
                      />
                    </td>

                    {/* DÉBITO */}
                    <td className="border p-2 text-right">
                      <input
                        inputMode="decimal"
                        type="number"
                        step="0.01"
                        className="w-full rounded border px-2 py-2 text-right"
                        value={r.debit ?? ""}
                        onChange={(ev) => setAmount(idx, "debit", ev.target.value)}
                      />
                    </td>

                    {/* CRÉDITO */}
                    <td className="border p-2 text-right">
                      <input
                        inputMode="decimal"
                        type="number"
                        step="0.01"
                        className="w-full rounded border px-2 py-2 text-right"
                        value={r.credit ?? ""}
                        onChange={(ev) => setAmount(idx, "credit", ev.target.value)}
                      />
                    </td>

                    {/* Acciones */}
                    <td className="border p-2 text-center">
                      <button
                        className="rounded bg-rose-600 px-2 py-1 text-white hover:bg-rose-700"
                        onClick={() => removeRow(idx)}
                        title="Eliminar línea"
                      >
                        ✖
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="bg-slate-50 font-medium">
                <td className="border p-2" colSpan={2}>
                  Totales
                </td>
                <td className="border p-2 text-right">{totals.debit.toFixed(2)}</td>
                <td className="border p-2 text-right">{totals.credit.toFixed(2)}</td>
                <td className="border p-2 text-center">
                  {isBalanced ? (
                    <span className="text-emerald-700">Asiento balanceado</span>
                  ) : (
                    <span className="text-rose-700">Dif: {totals.diff.toFixed(2)}</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-end gap-3">
          <button onClick={onCancel} className="rounded bg-slate-200 px-4 py-2 text-slate-800 hover:bg-slate-300">
            Cancelar
          </button>
          <button
            disabled={!canConfirm}
            onClick={onConfirm}
            className={`rounded px-4 py-2 text-white ${
              canConfirm ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"
            }`}
            title={canConfirm ? "Confirmar (asiento balanceado)" : "El asiento debe estar balanceado"}
          >
            ✅ Confirmar Asientos
          </button>
        </div>
      </div>
    </div>
  );
}