import React, { useEffect, useMemo, useState } from "react";
import { Rnd } from "react-rnd";
import type { Payable } from "@/types/Payable";
import { updatePayableTerms } from "@/services/payablesService";
import { buildInstallmentSchedule } from "@/utils/payable";

type Props = {
  isOpen: boolean;
  entityId: string;
  payable: Payable | null;
  onClose: () => void;
  onSaved?: () => void; // para refrescar lista en la página
};

function toInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function calculateDueDate(issueDate: string, termsDays: number): string {
  // issueDate esperado: "YYYY-MM-DD"
  const d = new Date(issueDate);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + termsDays);
  return d.toISOString().slice(0, 10);
}

export default function EditPayableTermsModal({
  isOpen,
  entityId,
  payable,
  onClose,
  onSaved,
}: Props) {

  if (!isOpen || !payable) return null;

  const p = payable;

  const [termsPreset, setTermsPreset] = useState<"30" | "60" | "90" | "custom">("30");
  const [installmentsPreset, setInstallmentsPreset] = useState<"1" | "2" | "3" | "custom">("1");

  const [customTermsDays, setCustomTermsDays] = useState<string>("30");
  const [customInstallments, setCustomInstallments] = useState<string>("1");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  // Inicializar valores al abrir / cambiar payable
  useEffect(() => {
    if (!isOpen || !payable) return;

    const current = payable;
    
    const td = toInt(current.termsDays, 30);
    const inst = toInt(current.installments, 1);

    if (td === 30 || td === 60 || td === 90) {
      setTermsPreset(String(td) as any);
    } else {
      setTermsPreset("custom");
      setCustomTermsDays(String(td));
    }

    if (inst === 1 || inst === 2 || inst === 3) {
      setInstallmentsPreset(String(inst) as any);
    } else {
      setInstallmentsPreset("custom");
      setCustomInstallments(String(inst));
    }

    setError("");
  }, [isOpen, payable]);

  const termsDays = useMemo(() => {
    if (termsPreset === "custom") return toInt(customTermsDays, 30);
    return toInt(termsPreset, 30);
  }, [termsPreset, customTermsDays]);

  const installments = useMemo(() => {
    if (installmentsPreset === "custom") return toInt(customInstallments, 1);
    return toInt(installmentsPreset, 1);
  }, [installmentsPreset, customInstallments]);

  const dueDatePreview = useMemo(() => {
    return calculateDueDate(p.issueDate, termsDays);
  }, [p.issueDate, termsDays]);

  const schedule = useMemo(() => {
    return buildInstallmentSchedule(p.total, p.issueDate, termsDays, installments);
  }, [p.total, p.issueDate, termsDays, installments]);


  async function handleSave() {
    try {
      setSaving(true);
      setError("");

      // validaciones básicas
      if (!entityId) throw new Error("entityId faltante");
      if (!p.id) throw new Error("payableId faltante");
      if (!p.issueDate) throw new Error("issueDate faltante");

      if (termsDays < 1 || termsDays > 3650) {
        throw new Error("termsDays debe estar entre 1 y 3650");
      }
      if (installments < 1 || installments > 60) {
        throw new Error("installments debe estar entre 1 y 60");
      }

      await updatePayableTerms(p.entityId, p.id, termsDays, installments, p.issueDate);

      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo guardar los plazos");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Rnd
        default={{
          x: Math.max(40, window.innerWidth / 2 - 320),
          y: Math.max(40, window.innerHeight / 2 - 220),
          width: 640,
          height: "auto",
        }}
        enableResizing={false}
        dragHandleClassName="drag-header"
        bounds="window"
      >
        <div className="bg-white rounded-xl shadow-xl w-full">
          {/* HEADER (drag) */}
          <div className="drag-header cursor-move px-6 py-4 border-b flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Editar plazos</h2>
              <p className="text-xs text-gray-500">
                {p.supplierName || "Proveedor"} • Factura {p.invoiceNumber || "—"}
              </p>
            </div>

            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-800 text-sm"
              disabled={saving}
              title="Cerrar"
            >
              ✕
            </button>
          </div>

          {/* BODY */}
          <div className="p-6 space-y-5">
            {/* Terms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Plazo (termsDays)</label>
                <select
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  value={termsPreset}
                  onChange={(e) => setTermsPreset(e.target.value as any)}
                  disabled={saving}
                >
                  <option value="30">30 días</option>
                  <option value="60">60 días</option>
                  <option value="90">90 días</option>
                  <option value="custom">Personalizado</option>
                </select>

                {termsPreset === "custom" && (
                  <input
                    className="mt-2 w-full border rounded px-3 py-2 text-sm"
                    type="number"
                    min={1}
                    max={3650}
                    value={customTermsDays}
                    onChange={(e) => setCustomTermsDays(e.target.value)}
                    disabled={saving}
                    placeholder="Ej: 45"
                  />
                )}
              </div>

              {/* Installments */}
              <div>
                <label className="text-sm font-medium">Cuotas (installments)</label>
                <select
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  value={installmentsPreset}
                  onChange={(e) => setInstallmentsPreset(e.target.value as any)}
                  disabled={saving}
                >
                  <option value="1">1 cuota</option>
                  <option value="2">2 cuotas</option>
                  <option value="3">3 cuotas</option>
                  <option value="custom">Personalizado</option>
                </select>

                {installmentsPreset === "custom" && (
                  <input
                    className="mt-2 w-full border rounded px-3 py-2 text-sm"
                    type="number"
                    min={1}
                    max={60}
                    value={customInstallments}
                    onChange={(e) => setCustomInstallments(e.target.value)}
                    disabled={saving}
                    placeholder="Ej: 4"
                  />
                )}
              </div>
            </div>

            {/* Preview */}
            <div className="bg-gray-50 border rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Fecha emisión</div>
                  <div className="font-medium">{p.issueDate || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Vence en</div>
                  <div className="font-medium">{termsDays} días</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Fecha vencimiento (dueDate)</div>
                  <div className="font-medium">{dueDatePreview || "—"}</div>
                </div>
              </div>

              {/* ✅ Calendario preview */}
              <div className="mt-4 border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">Cuota</th>
                      <th className="p-2">Vence</th>
                      <th className="p-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((i: any) => (
                      <tr key={i.index} className="border-t">
                        <td className="p-2">#{i.index}</td>
                        <td className="p-2">{i.dueDate}</td>
                        <td className="p-2 text-right">${Number(i.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
                {error}
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="px-6 py-4 border-t flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded border text-sm hover:bg-gray-50"
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </Rnd>
    </div>
  );
}

