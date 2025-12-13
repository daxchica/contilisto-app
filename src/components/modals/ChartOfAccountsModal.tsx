// src/components/ChartOfAccountsModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import ECUADOR_COA from "@/../shared/coa/ecuador_coa";
import {
  createSubaccount,
  fetchCustomAccounts,
  deleteCustomAccount,
} from "../../services/chartOfAccountsService";
import type { Account, CustomAccount } from "../../types/AccountTypes";
import { auth } from "../../firebase-config";
import { JournalEntry } from "../../types/JournalEntry";

interface Props {
  entityId: string;
  onClose: () => void;
  accounts?: Account[];
  onUploadComplete: (entries: JournalEntry[]) => void;
}

export default function ChartOfAccountsModal({ entityId, onClose }: Props) {
  const [q, setQ] = useState("");
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [custom, setCustom] = useState<CustomAccount[]>([]);
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const uid = auth.currentUser?.uid ?? "";

  // ✅ Load custom accounts from Firestore
  useEffect(() => {
    (async () => {
      const rows = await fetchCustomAccounts(entityId);
      setCustom(rows);
    })();
  }, [entityId]);

  // ✅ Merge system and custom accounts safely with "level"
  const merged: Account[] = useMemo(() => {
    const map = new Map<string, Account>();
    for (const a of ECUADOR_COA)
      map.set(a.code, {
        ...a,
        level: (a.level ?? Math.floor(a.code.length / 2)) || 1,
      });
    for (const c of custom)
      map.set(c.code, {
        code: c.code,
        name: c.name,
        level: (Math.floor(c.code.length / 2)) || 1,
        isReceivable: (c as any).isReceivable ?? false,
        isPayable: (c as any).isPayable ?? false,
      });

    return Array.from(map.values()).sort((a, b) =>
      a.code.localeCompare(b.code, "es", { numeric: true })
    );
  }, [custom]);

  const filtered = useMemo(() => {
    const norm = (s: string) =>
      (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    const nq = norm(q);
    if (!nq) return merged;
    return merged.filter(
      (a) => norm(a.name).includes(nq) || a.code.includes(nq)
    );
  }, [q, merged]);

  const parent = useMemo(
    () => merged.find((a) => a.code === selectedCode) || null,
    [selectedCode, merged]
  );

  const startCreate = () => {
    if (!selectedCode) {
      alert("Selecciona primero la cuenta padre en la lista.");
      return;
    }
    setNewCode("");
    setNewName("");
    setCreating(true);
  };

  // ✅ Create subaccount in Firestore
  const submitCreate = async () => {
    if (!parent) return;
    const code = newCode.trim();
    const name = newName.trim();

    if (!code || !name) {
      alert("Código y nombre son obligatorios.");
      return;
    }
    if (!/^\d{1,20}$/.test(code)) {
      alert("El código debe ser numérico (hasta 20 dígitos).");
      return;
    }
    if (!code.startsWith(parent.code)) {
      alert(`El código de la subcuenta debe comenzar con el padre: ${parent.code}`);
      return;
    }
    if (merged.some((a) => a.code === code)) {
      alert("Ya existe una cuenta con ese código.");
      return;
    }

    setSaving(true);
    try {
      await createSubaccount(entityId, {
        code,
        name,
        parentCode: parent.code,
        userId: uid || undefined,
      });

      setCustom((prev) => [
        ...prev,
        {
          code,
          name,
          parentCode: parent.code,
          entityId,
          userId: uid || undefined,
          createdAt: Date.now(),
          level: Math.floor(code.length / 2) || 1,
          isReceivable: false,
          isPayable: false,
        } satisfies CustomAccount,
      ]);

      // ✅ Refresh event for AccountingDashboard
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("refreshAccounts"));
      }

      setCreating(false);
      alert("✅ Subcuenta creada correctamente.");
    } catch (e) {
      console.error(e);
      alert("No se pudo crear la subcuenta.");
    } finally {
      setSaving(false);
    }
  };

  // ✅ Delete subaccount
  const remove = async (code: string) => {
    const row = custom.find((c) => c.code === code);
    if (!row) return;
    if (!confirm(`¿Eliminar la subcuenta ${code} - ${row.name}?`)) return;
    try {
      await deleteCustomAccount(entityId, code);
      setCustom((prev) => prev.filter((c) => c.code !== code));

      // ✅ Refresh event for AccountingDashboard
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("refreshAccounts"));
      }

      alert("🗑️ Subcuenta eliminada.");
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar la subcuenta.");
    }
  };

  // ✅ Toggle receivable/payable
  const handleToggle = async (
    row: Account,
    flag: "isReceivable" | "isPayable",
    checked: boolean
  ) => {
    const rowData = custom.find((c) => c.code === row.code);
    if (!rowData) {
      alert("Solo puedes editar cuentas personalizadas.");
      return;
    }
    try {
      await createSubaccount(entityId, { ...rowData, [flag]: checked });
      setCustom((prev) =>
        prev.map((c) =>
          c.code === row.code ? { ...c, [flag]: checked } : c
        )
      );

      // ✅ Refresh event
      window.dispatchEvent(new Event("refreshAccounts"));
    } catch (err) {
      console.error("⚠️ Error updating flag:", err);
      alert("No se pudo actualizar la cuenta.");
    }
  };

  return (
    <div className="coa-modal__backdrop">
      <div className="coa-modal">
        <header className="coa-modal__header">
          <h2>Plan de Cuentas</h2>
          <button className="btn btn--danger" onClick={onClose}>
            Cerrar
          </button>
        </header>

        <input
          className="coa-modal__search"
          placeholder="Buscar por código o nombre…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="coa-modal__actions">
          <button className="btn" onClick={startCreate}>
            ➕ Crear subcuenta
          </button>
          {parent && (
            <span className="coa-modal__hint">
              Padre seleccionado: <strong>{parent.code}</strong> – {parent.name}
            </span>
          )}
        </div>

        {creating && (
          <div className="coa-modal__create">
            <div className="coa-modal__create__row">
              <label>Código</label>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder={`Debe empezar con ${parent?.code ?? ""}`}
                inputMode="numeric"
              />
            </div>
            <div className="coa-modal__create__row">
              <label>Nombre</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre de la subcuenta"
              />
            </div>
            <div className="coa-modal__create__actions">
              <button
                className="btn btn--ghost"
                onClick={() => setCreating(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className="btn btn--primary"
                onClick={submitCreate}
                disabled={saving}
              >
                Crear
              </button>
            </div>
          </div>
        )}

        <div className="coa-modal__tablewrap">
          <table className="coa-modal__table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th title="Cuentas por Cobrar">🧾 CxC</th>
                <th title="Cuentas por Pagar">💰 CxP</th>
                <th className="coa-col-narrow" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const isCustom = custom.some((c) => c.code === row.code);
                const isSystem = !isCustom;
                const rowData = custom.find((c) => c.code === row.code);
                const selected = row.code === selectedCode;

                return (
                  <tr
                    key={row.code}
                    className={`${selected ? "is-selected" : ""} ${
                      isSystem ? "is-system" : "is-custom"
                    }`}
                    onClick={() => setSelectedCode(row.code)}
                    title={
                      isSystem
                        ? "Cuenta del sistema (no editable)"
                        : "Cuenta personalizada"
                    }
                  >
                    <td className="mono">{row.code}</td>
                    <td>{row.name}</td>

                    {/* CxC */}
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={!!rowData?.isReceivable}
                        onChange={(e) =>
                          handleToggle(row, "isReceivable", e.target.checked)
                        }
                        disabled={isSystem}
                        className={`coa-checkbox ${
                          isSystem ? "disabled" : ""
                        }`}
                      />
                    </td>

                    {/* CxP */}
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={!!rowData?.isPayable}
                        onChange={(e) =>
                          handleToggle(row, "isPayable", e.target.checked)
                        }
                        disabled={isSystem}
                        className={`coa-checkbox ${
                          isSystem ? "disabled" : ""
                        }`}
                      />
                    </td>

                    {/* Actions */}
                    <td className="coa-modal__rowactions">
                      {isCustom && (
                        <button
                          className="btn btn--xs btn--danger-outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(row.code);
                          }}
                          title="Eliminar subcuenta"
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    Sin resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="coa-modal__footer">
          <small>
            {merged.length} cuentas totales. Las subcuentas que crees aquí serán
            usadas por la AI al clasificar facturas y asientos.
          </small>
        </footer>
      </div>
    </div>
  );
}