// src/components/modals/ChartOfAccountsModal.tsx

import React, { useEffect, useMemo, useState } from "react";
import type { Account } from "@/types/AccountTypes";
import MovableModal from "@/components/ui/MovableModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getEffectiveAccountPlan } from "@/services/effectiveAccountsService";
import { deleteAccount } from "@/services/entityAccountsService";
import CreateSubaccountModal from "@/components/accounts/CreateSubaccountModal";

interface Props {
  entityId: string;
  entityName: string;
  onClose: () => void;
  onAccountsChanged?: () => void;
}

/* =====================================================
   TREE BUILDERS
===================================================== */

function buildTree(accounts: Account[]) {
  const children = new Map<string, Account[]>();
  const roots: Account[] = [];

  for (const acc of accounts) {
    children.set(acc.code, []);
  }

  for (const acc of accounts) {
    if (acc.parentCode) {
      const parentChildren = children.get(acc.parentCode);
      if (parentChildren) {
        parentChildren.push(acc);
      }
    } else {
      roots.push(acc);
    }
  }

  // sort children
  for (const list of children.values()) {
    list.sort((a, b) =>
      a.code.localeCompare(b.code, "es", { numeric: true })
    );
  }

  roots.sort((a, b) =>
    a.code.localeCompare(b.code, "es", { numeric: true })
  );

  return { roots, children };
}

function flatten(roots: Account[], children: Map<string, Account[]>): Account[] {
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
  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [postableSet, setPostableSet] = useState<Set<string>>(new Set());

  /* =====================================================
     LOAD PLAN
  ===================================================== */

  const loadPlan = async () => {
    const plan = await getEffectiveAccountPlan(entityId);
    setAccounts(plan.effectiveAccounts);
    setPostableSet(plan.postableCodeSet);
  };

  useEffect(() => {
    loadPlan();
  }, [entityId]);

  /* =====================================================
     TREE
  ===================================================== */

  const flattened = useMemo(() => {
    const { roots, children } = buildTree(accounts);
    return flatten(roots, children);
  }, [accounts]);

  const parent = useMemo(
    () => flattened.find(a => a.code === selectedCode) ?? null,
    [flattened, selectedCode]
  );

  const hasChildren = (code: string) =>
    accounts.some(a => a.parentCode === code);

  const isLeaf = (code: string) => postableSet.has(code);

  /* =====================================================
     FILTER + COLLAPSE
  ===================================================== */

  const visibleRows = useMemo(() => {
    const result: Account[] = [];
    const hiddenStack: number[] = [];

    for (const row of flattened) {
      while (
        hiddenStack.length &&
        row.level <= hiddenStack[hiddenStack.length - 1]
      ) {
        hiddenStack.pop();
      }

      if (hiddenStack.length) continue;

      if (
        search &&
        !row.code.includes(search) &&
        !row.name.toLowerCase().includes(search.toLowerCase())
      ) {
        continue;
      }

      result.push(row);

      if (collapsed.has(row.code)) {
        hiddenStack.push(row.level);
      }
    }

    return result;
  }, [flattened, collapsed, search]);

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

  const handleDelete = async (code: string) => {
    const row = accounts.find(a => a.code === code);
    if (!row) return;

    if (row.isSystem) {
      alert("No se puede eliminar una cuenta del sistema.");
      return;
    }

    if (!confirm(`¿Eliminar ${code} - ${row.name}?`)) return;

    await deleteAccount(entityId, code);
    await loadPlan();
    onAccountsChanged?.();
  };

  /* =====================================================
     EXPORT
  ===================================================== */

  const exportCSV = () => {
    const header = ["Código", "Nombre", "Nivel"];

    const rows = visibleRows.map(a => [
      a.code,
      `${"  ".repeat(a.level - 1)}${a.name}`,
      a.level,
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

    autoTable(doc, {
      startY: 60,
      head: [["Código", "Nombre"]],
      body: visibleRows.map(a => [
        a.code,
        `${"    ".repeat(a.level - 1)}${a.name}`,
      ]),
    });

    doc.save(`Plan_de_Cuentas_${entityName}.pdf`);
  };

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <MovableModal
      isOpen
      title={`Plan de Cuentas – ${entityName}`}
      onClose={onClose}
    >
      <input
        placeholder="Buscar..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <button
          onClick={() => {
            if (!parent) {
              alert("Selecciona una cuenta padre.");
              return;
            }
            setShowCreateModal(true);
          }}
        >
          ➕ Crear subcuenta
        </button>

        <div>
          <button onClick={exportCSV}>CSV</button>
          <button onClick={exportPDF}>PDF</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {visibleRows.map(row => (
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
                {!row.isSystem && isLeaf(row.code) && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleDelete(row.code);
                    }}
                  >
                    Eliminar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {parent && (
        <CreateSubaccountModal
          entityId={entityId}
          parentAccount={parent}
          existingAccounts={accounts}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={async () => {
            await loadPlan();
            onAccountsChanged?.();
          }}
        />
      )}
    </MovableModal>
  );
}