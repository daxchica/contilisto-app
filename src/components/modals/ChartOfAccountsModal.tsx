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
import MovableModal from "../ui/MovableModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
  entityId: string;
  entityName: string;
  onClose: () => void;
  onAccountsChanged?: () => void;
}

// ---------------------------------------------------------------------------
// TREE HELPERS (THIS IS THE KEY PART)
// ---------------------------------------------------------------------------

function buildAccountTree(accounts: Account[]) {
  const byCode = new Map<string, Account>();
  const children = new Map<string, Account[]>();

  for (const acc of accounts) {
    byCode.set(acc.code, acc);
    children.set(acc.code, []);
  }

  const roots: Account[] = [];

  for (const acc of accounts) {
    const parentCode =
      acc.code.length > 1 ? acc.code.slice(0, acc.code.length - 2) : null;

    if (parentCode && byCode.has(parentCode)) {
      children.get(parentCode)!.push(acc);
    } else {
      roots.push(acc);
    }
  }

  // Sort siblings numerically
  for (const list of children.values()) {
    list.sort((a, b) => Number(a.code) - Number(b.code));
  }

  roots.sort((a, b) => Number(a.code) - Number(b.code));

  return { roots, children };
}

function flattenTree(
  roots: Account[],
  children: Map<string, Account[]>
): Account[] {
  const result: Account[] = [];

  const visit = (node: Account) => {
    result.push(node);
    const kids = children.get(node.code) ?? [];
    for (const k of kids) visit(k);
  };

  for (const r of roots) visit(r);
  return result;
}


// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------

export default function ChartOfAccountsModal({
  entityId,
  entityName,
  onClose,
  onAccountsChanged,
}: Props) {
  const [q, setQ] = useState("");
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [custom, setCustom] = useState<CustomAccount[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const uid = auth.currentUser?.uid ?? "";

  // ---------------------------------------------------------------------------
  // LOAD CUSTOM ACCOUNTS
  // ---------------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      const rows = await fetchCustomAccounts(entityId);
      setCustom(rows);
    })();
  }, [entityId]);

  // ---------------------------------------------------------------------------
  // MERGE + TREE ORDER
  // ---------------------------------------------------------------------------

  const merged: Account[] = useMemo(() => {
    const map = new Map<string, Account>();

    // System accounts
    for (const a of ECUADOR_COA) {
      map.set(a.code, {
        ...a,
        level: a.level ?? (Math.floor(a.code.length / 2) || 1),
      });
    }

    // Custom accounts override / extend
    for (const c of custom) {
      map.set(c.code, {
        code: c.code,
        name: c.name,
        level: Math.floor(c.code.length / 2) || 1,
        isReceivable: c.isReceivable ?? false,
        isPayable: c.isPayable ?? false,
      });
    }

    const all = Array.from(map.values());
    const { roots, children } = buildAccountTree(all);
    return flattenTree(roots, children);
  }, [custom]);

  /* ---------------------------------------------------------------------- */
  /* TREE UTILITIES */
  /* ---------------------------------------------------------------------- */

  const hasChildren = (code: string) => {
    return merged.some(
      (a) =>
        a.code !== code &&
        a.code.startsWith(code) &&
        a.code.length === code.length + 2
    );
  };

  /* ---------------------------------------------------------------------- */
  /* FILTER + COLLAPSE LOGIC */
  /* ---------------------------------------------------------------------- */

  const visibleRows = useMemo(() => {
  const result: Account[] = [];
  const collapsedStack: { code: string; level: number }[] = [];

    for (const row of merged) {
      // Remove inactive collapsed parents
      while (
        collapsedStack.length &&
        row.level <= collapsedStack[collapsedStack.length - 1].level
      ) {
        collapsedStack.pop();
      }

      // If inside a collapsed parent → skip
      if (collapsedStack.length) continue;

      result.push(row);

      // If row itself is collapsed → push to stack
      if (collapsed.has(row.code)) {
        collapsedStack.push({ code: row.code, level: row.level });
      }
    }

    return result;
  }, [merged, collapsed]);

  const parent = selectedCode
    ? merged.find((a) => a.code === selectedCode) ?? null
    : null;

  /* -------------------------------------------------- */
  /* NEXT CHILD CODE (AUTO-SEQUENCE, +2 DIGITS RULE) */
  /* -------------------------------------------------- */

  const nextChildCode = useMemo(() => {
    if (!parent) return "";

    const children = merged.filter(
      (a) =>
        a.code.startsWith(parent.code) &&
        a.code.length === parent.code.length + 2
    );

    if (!children.length) return `${parent.code}01`;

    const max = Math.max(
      ...children.map((c) => Number(c.code.slice(-2)))
    );

    return `${parent.code}${String(max + 1).padStart(2, "0")}`;
  }, [parent, merged]);

  /* ---------------------------------------------------------------------- */
  /* COLLAPSE TOGGLE */
  /* ---------------------------------------------------------------------- */

  const toggleCollapse = (code: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // CREATE SUBACCOUNT
  // ---------------------------------------------------------------------------

  const startCreate = () => {
    if (!parent) {
      alert("Selecciona una cuenta padre primero.");
      return;
    }
    setNewCode(nextChildCode);
    setCreating(true);
  };

  const submitCreate = async () => {
    if (!parent) return;

    const code = newCode.trim();
    const name = newName.trim();

    if (!code || !name) return alert("Código y nombre son obligatorios.");
    
    const expectedLength = parent.code.length + 2;

    if (!/^\d+$/.test(code)) {
      alert("El código debe ser numérico.");
      return;
    }

    if (!code.startsWith(parent.code)) 
      return alert(`Debe iniciar con ${parent.code}`);

    if (code.length !== expectedLength) {
      alert(
        `El código debe tener exactamente ${expectedLength} dígitos ` +
        `(2 más que la cuenta padre)`
      );
      return;
    }

    if (merged.some((a) => a.code === code)) 
      return alert("Cuenta ya existe");

    setSaving(true);
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
      },
    ]);

    window.dispatchEvent(new Event("refreshAccounts"));
    setCreating(false);
    setNewCode("");
    setNewName("");
    setSaving(false);
    alert("✅ Subcuenta creada.");
  };

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  const remove = async (code: string) => {
    const row = custom.find((c) => c.code === code);
    if (!row) return;

    if (!confirm(`¿Eliminar ${code} - ${row.name}?`)) return;

    await deleteCustomAccount(entityId, code);
    setCustom((prev) => prev.filter((c) => c.code !== code));
    onAccountsChanged?.();
    window.dispatchEvent(new Event("refreshAccounts"));
  };

  // ---------------------------------------------------------------------------
  // TOGGLE FLAGS
  // ---------------------------------------------------------------------------

  const handleToggle = async (
    row: Account,
    flag: "isReceivable" | "isPayable",
    checked: boolean
  ) => {
    const rowData = custom.find((c) => c.code === row.code);
    if (!rowData) {
      alert("Solo editable en cuentas personalizadas.");
      return;
    }

    await createSubaccount(entityId, { ...rowData, [flag]: checked });
    setCustom((prev) =>
      prev.map((c) =>
        c.code === row.code ? { ...c, [flag]: checked } : c
      )
    );

    window.dispatchEvent(new Event("refreshAccounts"));
  };

  const exportCSV = () => {
  const header = ["Código", "Nombre", "Nivel", "CxC", "CxP"];

  const rows = visibleRows.map((a) => [
    a.code,
    `${"  ".repeat(a.level - 1)}${a.name}`,
    a.level,
    a.isReceivable ? "Sí" : "",
    a.isPayable ? "Sí" : "",
  ]);

  const csvContent =
    [header, ...rows]
      .map((row) =>
        row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

  const blob = new Blob(["\ufeff" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Plan_de_Cuentas_${entityName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const exportPDF = () => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  doc.setFontSize(14);
  doc.text("Plan de Cuentas", 40, 40);

  doc.setFontSize(10);
  doc.text(`Empresa: ${entityName}`, 40, 60);

  autoTable(doc, {
    startY: 80,
    head: [["Código", "Nombre", "CxC", "CxP"]],
    body: visibleRows.map((a) => [
      a.code,
      `${"    ".repeat(a.level - 1)}${a.name}`,
      a.isReceivable ? "✔" : "",
      a.isPayable ? "✔" : "",
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: [37, 99, 235], // azul similar al modal
      textColor: 255,
    },
    theme: "grid",
  });

  doc.save(`Plan_de_Cuentas_${entityName}.pdf`);
};

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <MovableModal
      isOpen
      title={`Plan de Cuentas (Empresa: ${entityName})`}
      onClose={onClose}
    >
      <input
        className="coa-modal__search"
        placeholder="Buscar por código o nombre…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div
        className="coa-modal__actions"
        style={{ 
          display: "flex", 
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        {/* LEFT */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn" onClick={startCreate}>
            ➕ Crear subcuenta
          </button>

          {parent && (
            <span className="coa-modal__hint">
              Padre: <strong>{parent.code}</strong> – {parent.name}
            </span>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", gap: 8 }}>
          <button 
            className="btn"
            style={{
              background: "#16a34a", 
              color: "white",
              padding: "8px 14px",
              borderRadius: "8px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }} 
            onClick={exportCSV}>
            📤 CSV
          </button>

          <button 
            className="btn btn--ghost" 
            style={{
              background: "#16a34a", 
              color: "white",
              padding: "8px 14px",
              borderRadius: "8px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px" 
            }} 
            onClick={exportPDF}>
            📄 PDF
          </button>
        </div>
      </div>
      
      {creating && (
        <div className="coa-modal__create">
          <label>Código</label>
          <input value={newCode} onChange={(e) => setNewCode(e.target.value)} />
          <label>Nombre</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} />
          <div>
            <button onClick={() => setCreating(false)}>Cancelar</button>
            <button onClick={submitCreate} disabled={saving}>
              Crear
            </button>
          </div>
        </div>
      )}

      <table className="coa-modal__table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>🧾 CxC</th>
            <th>💰 CxP</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => {
            const isCustom = custom.some((c) => c.code === row.code);
            const rowData = custom.find((c) => c.code === row.code);

            return (
              <tr
                key={row.code}
                onClick={() => setSelectedCode(row.code)}
              >
                <td className="mono">{row.code}</td>
                <td style={{ paddingLeft: `${(row.level - 1) * 18}px` }}>
                  {hasChildren(row.code) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCollapse(row.code);
                      }}
                      style={{
                        marginRight: 6,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {collapsed.has(row.code) ? "▶" : "▼"}
                    </button>
                  )}
                  {row.name}
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={!!rowData?.isReceivable}
                    disabled={!isCustom}
                    onChange={(e) =>
                      handleToggle(row, "isReceivable", e.target.checked)
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={!!rowData?.isPayable}
                    disabled={!isCustom}
                    onChange={(e) =>
                      handleToggle(row, "isPayable", e.target.checked)
                    }
                  />
                </td>
                <td>
                  {isCustom && (
                    <button onClick={() => remove(row.code)}>Eliminar</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <footer>
        <small>{merged.length} cuentas totales</small>
      </footer>
    </MovableModal>
  );
}