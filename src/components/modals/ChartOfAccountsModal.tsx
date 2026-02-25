import React, { useEffect, useMemo, useState } from "react";
import {
  createSubaccount,
  deleteCustomAccount,
} from "../../services/chartOfAccountsService";
import type { Account, CustomAccount } from "../../types/AccountTypes";
import MovableModal from "../ui/MovableModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getEffectiveAccountPlan } from "@/services/effectiveAccountsService";
import CreateSubaccountModal from "../accounts/CreateSubaccountModal";

interface Props {
  entityId: string;
  entityName: string;
  onClose: () => void;
  onAccountsChanged?: () => void;
}

/* =====================================================
   TREE HELPERS
===================================================== */

function buildAccountTree(accounts: Account[]) {
  const byCode = new Map<string, Account>();
  const children = new Map<string, Account[]>();

  for (const acc of accounts) {
    byCode.set(acc.code, acc);
    children.set(acc.code, []);
  }

  const roots: Account[] = [];

  for (const acc of accounts) {
    const parent = accounts.find(
      a => a.level === acc.level - 1 && acc.code.startsWith(a.code)
    );

    if (parent) {
      children.get(parent.code)!.push(acc);
    } else {
      roots.push(acc);
    }
  }

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

/* =====================================================
   COMPONENT
===================================================== */

export default function ChartOfAccountsModal({
  entityId,
  entityName,
  onClose,
  onAccountsChanged,
}: Props) {
  const [q, setQ] = useState("");
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [effectiveAccounts, setEffectiveAccounts] = useState<Account[]>([]);
  const [leafAccounts, setLeafAccounts] = useState<Account[]>([]);
  const [customAccounts, setCustomAccounts] = useState<CustomAccount[]>([]);

  /* =====================================================
     LOAD PLAN
  ===================================================== */

  const reloadPlan = async () => {
    const plan = await getEffectiveAccountPlan(entityId);
    setEffectiveAccounts(plan.effectiveAccounts);
    setLeafAccounts(plan.leafAccounts);
    setCustomAccounts(plan.customAccounts);
  };

  useEffect(() => {
    let active = true;

    (async () => {
      const plan = await getEffectiveAccountPlan(entityId);
      if (!active) return;

      setEffectiveAccounts(plan.effectiveAccounts);
      setLeafAccounts(plan.leafAccounts);
      setCustomAccounts(plan.customAccounts);
    })();

    return () => {
      active = false;
    };
  }, [entityId]);

  /* =====================================================
     MEMOS
  ===================================================== */

  const customMap = useMemo(() => {
    const map = new Map<string, CustomAccount>();
    customAccounts.forEach(c => map.set(c.code, c));
    return map;
  }, [customAccounts]);

  const isLeaf = (code: string) =>
    leafAccounts.some(a => a.code === code);

  const merged = useMemo(() => {
    const { roots, children } = buildAccountTree(effectiveAccounts);
    return flattenTree(roots, children);
  }, [effectiveAccounts]);

  const parent = useMemo(() => {
    return merged.find(a => a.code === selectedCode) ?? null;
  }, [merged, selectedCode]);

  const hasChildren = (code: string) => {
    const parent = effectiveAccounts.find(a => a.code === code);
    if (!parent) return false;

    return effectiveAccounts.some(
      a =>
        a.code !== code &&
        a.level === parent.level + 1 &&
        a.code.startsWith(code)
    );
  };

  /* =====================================================
     FILTER + COLLAPSE
  ===================================================== */

  const visibleRows = useMemo(() => {
    const result: Account[] = [];
    const collapsedStack: { level: number }[] = [];

    for (const row of merged) {
      while (
        collapsedStack.length &&
        row.level <= collapsedStack[collapsedStack.length - 1].level
      ) {
        collapsedStack.pop();
      }

      if (collapsedStack.length) continue;

      if (
        q &&
        !row.code.includes(q) &&
        !row.name.toLowerCase().includes(q.toLowerCase())
      ) {
        continue;
      }

      result.push(row);

      if (collapsed.has(row.code)) {
        collapsedStack.push({ level: row.level });
      }
    }

    return result;
  }, [merged, collapsed, q]);

  /* =====================================================
     ACTIONS
  ===================================================== */

  const toggleCollapse = (code: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const remove = async (code: string) => {
    const row = customMap.get(code);
    if (!row) return;

    if (!confirm(`¿Eliminar ${code} - ${row.name}?`)) return;

    await deleteCustomAccount(entityId, code);
    await reloadPlan();
    onAccountsChanged?.();
  };

  const handleToggle = async (
    row: Account,
    flag: "isReceivable" | "isPayable",
    checked: boolean
  ) => {
    if (!isLeaf(row.code)) {
      alert("Solo las subcuentas finales pueden marcarse.");
      return;
    }

    const rowData = customMap.get(row.code);
    if (!rowData) {
      alert("Solo editable en cuentas personalizadas.");
      return;
    }

    await createSubaccount(entityId, {
      code: rowData.code,
      name: rowData.name,
      parentCode: rowData.parentCode,
      level: rowData.level,
      [flag]: checked,
    });

    await reloadPlan();
  };

  /* =====================================================
     EXPORTS
  ===================================================== */

  const exportCSV = () => {
    const header = ["Código", "Nombre", "Nivel", "CxC", "CxP"];

    const rows = visibleRows.map(a => [
      a.code,
      `${"  ".repeat(a.level - 1)}${a.name}`,
      a.level,
      a.isReceivable ? "Sí" : "",
      a.isPayable ? "Sí" : "",
    ]);

    const csv =
      [header, ...rows]
        .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const blob = new Blob(["\ufeff" + csv], {
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
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    doc.text(`Plan de Cuentas – ${entityName}`, 40, 40);
    doc.text(`Generado: ${new Date().toLocaleDateString()}`, 40, 25);

    autoTable(doc, {
      startY: 60,
      head: [["Código", "Nombre", "CxC", "CxP"]],
      body: visibleRows.map(a => [
        a.code,
        `${"    ".repeat(a.level - 1)}${a.name}`,
        a.isReceivable ? "✔" : "",
        a.isPayable ? "✔" : "",
      ]),
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    });

    doc.save(`Plan_de_Cuentas_${entityName}.pdf`);
  };

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <MovableModal
      isOpen
      title={`Plan de Cuentas (Empresa: ${entityName})`}
      onClose={onClose}
    >
      <input
        placeholder="Buscar por código o nombre…"
        value={q}
        onChange={e => setQ(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <button
          onClick={() => {
            if (!parent) {
              alert("Selecciona una cuenta padre primero.");
              return;
            }
            setShowCreateModal(true);
          }}
        >
          ➕ Crear subcuenta
        </button>

        <div>
          <button onClick={exportCSV}>📤 CSV</button>
          <button onClick={exportPDF}>📄 PDF</button>
        </div>
      </div>

      <table>
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
          {visibleRows.map(row => {
            const rowData = customMap.get(row.code);
            const isCustom = !!rowData;

            return (
              <tr
                key={row.code}
                onClick={() => setSelectedCode(row.code)}
                style={{
                  backgroundColor:
                    selectedCode === row.code ? "#eef2ff" : "transparent",
                }}
              >
                <td>{row.code}</td>
                <td style={{ paddingLeft: `${(row.level - 1) * 18}px` }}>
                  {hasChildren(row.code) && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        toggleCollapse(row.code);
                      }}
                    >
                      {collapsed.has(row.code) ? "▶" : "▼"}
                    </button>
                  )}
                  {row.name}
                </td>

                <td>
                  {isCustom && isLeaf(row.code) ? (
                    <input
                      type="checkbox"
                      checked={!!rowData?.isReceivable}
                      onChange={e => {
                        e.stopPropagation();
                        handleToggle(row, "isReceivable", e.target.checked);
                      }}
                    />
                  ) : (
                    <span>—</span>
                  )}
                </td>

                <td>
                  {isCustom && isLeaf(row.code) ? (
                    <input
                      type="checkbox"
                      checked={!!rowData?.isPayable}
                      onChange={e => {
                        e.stopPropagation();
                        handleToggle(row, "isPayable", e.target.checked);
                      }}
                    />
                  ) : (
                    <span>—</span>
                  )}
                </td>

                <td>
                  {isCustom && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        remove(row.code);
                      }}
                    >
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {parent && (
        <CreateSubaccountModal
          entityId={entityId}
          parentAccount={parent}
          existingAccounts={effectiveAccounts}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={async () => {
            await reloadPlan();
            onAccountsChanged?.();
          }}
        />
      )}
    </MovableModal>
  );
}