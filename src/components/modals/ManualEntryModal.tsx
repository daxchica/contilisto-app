// ============================================================================
// src/components/ManualEntryModal.tsx
// CONTILISTO — MANUAL ENTRY (PRODUCTION SAFE FINAL)
// ============================================================================

import React, { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Rnd } from "react-rnd";
import { v4 as uuidv4 } from "uuid";

import type { Account } from "../../types/AccountTypes";
import type { JournalEntry } from "../../types/JournalEntry";

import AccountPicker from "../AccountPicker";
import { canonicalPair, normalizeEntry } from "../../utils/accountPUCMap";

/* =============================================================================
   TYPES
============================================================================= */

interface Props {
  entityId: string;
  userIdSafe: string;
  postableAccounts: Account[];
  leafCodeSet: Set<string>;
  onClose: () => void;
  onAddEntries: (entries: JournalEntry[]) => Promise<void>;
}

type Row = Omit<JournalEntry, "thirdParty" | "documentRef"> & {
  thirdParty?: string | null;
  documentRef?: string | null;
  requiresThirdParty?: boolean;
  _debitRaw?: string;
  _creditRaw?: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

/* =============================================================================
   ROW FACTORY
============================================================================= */

function createEmptyRow(
  entityId: string,
  userIdSafe: string,
  transactionId: string
): Row {
  return {
    id: uuidv4(),

    entityId,
    uid: userIdSafe,

    transactionId,
    transactionType: "initial_balance", // ✅ FIX (manual ≠ invoice)
    documentNature: "opening",          // ✅ FIX

    account_code: "",
    account_name: "",

    debit: 0,
    credit: 0,

    description: "",
    date: todayISO(),

    source: "manual",
    isManual: true,

    createdAt: Date.now(),

    thirdParty: null,
    documentRef: null,
    requiresThirdParty: false,
  };
}

/* =============================================================================
   COMPONENT
============================================================================= */

export default function ManualEntryModal({
  entityId,
  userIdSafe,
  postableAccounts,
  leafCodeSet,
  onClose,
  onAddEntries,
}: Props) {
  const [txId] = useState(() => uuidv4());

  const [rows, setRows] = useState<Row[]>([
    createEmptyRow(entityId, userIdSafe, txId),
    createEmptyRow(entityId, userIdSafe, txId),
  ]);

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const [supplierName, setSupplierName] = useState("");
  const [issuerRUC, setIssuerRUC] = useState("");

  /* =============================================================================
     TOTALS
  ============================================================================= */

  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + Number(r.debit ?? 0), 0);
    const credit = rows.reduce((s, r) => s + Number(r.credit ?? 0), 0);

    return {
      debit: +debit.toFixed(2),
      credit: +credit.toFixed(2),
      diff: +(debit - credit).toFixed(2),
    };
  }, [rows]);

  const isBalanced =
    Math.abs(totals.diff) < 0.01 &&
    totals.debit > 0 &&
    totals.credit > 0;

  /* =============================================================================
     PATCH ROW
  ============================================================================= */

  const patchRow = (idx: number, patch: Partial<Row>) => {
    setRows((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };

      const canon = normalizeEntry({
        account_code: merged.account_code,
        account_name: merged.account_name,
      });

      next[idx] = {
        ...merged,
        account_code: canon.account_code,
        account_name: canon.account_name,
        debit: Number(merged.debit ?? 0),
        credit: Number(merged.credit ?? 0),
      };

      return next;
    });
  };

  /* =============================================================================
     ACCOUNT SELECT
  ============================================================================= */

  const applyAccount = (idx: number, acc: Account | null) => {
    if (!acc) return;

    if (!leafCodeSet.has(acc.code)) {
      alert("⚠️ Solo subcuentas finales permitidas.");
      return;
    }

    const canon = canonicalPair(acc);

    patchRow(idx, {
      account_code: canon.code,
      account_name: canon.name,
    });
  };

  /* =============================================================================
     ROW OPS
  ============================================================================= */

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      createEmptyRow(entityId, userIdSafe, txId),
    ]);

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const duplicateRow = () => {
    if (selectedIdx == null) return;

    const base = rows[selectedIdx];

    const copy: Row = {
      ...base,
      id: uuidv4(),
      createdAt: Date.now(),
      debit: Number(base.debit ?? 0),
      credit: Number(base.credit ?? 0),
    };

    setRows((prev) => {
      const next = [...prev];
      next.splice(selectedIdx + 1, 0, copy);
      return next;
    });

    setSelectedIdx(selectedIdx + 1);
  };

  /* =============================================================================
     SAVE (PRODUCTION SAFE)
  ============================================================================= */

  const handleSave = async () => {
    if (!isBalanced || isSaving) return;

    // ✅ VALIDATION
    const invalid = rows.filter(
      (r) => !r.account_code || !leafCodeSet.has(r.account_code)
    );

    if (invalid.length > 0) {
      alert("❌ Hay cuentas inválidas.");
      return;
    }

    setIsSaving(true);

    const date = rows[0]?.date || todayISO();
    const description = rows[0]?.description?.trim() || "";

    if (!description) {
      alert("Debe ingresar una descripción.");
      setIsSaving(false);
      return;
    }

    const cleaned: JournalEntry[] = rows.map((r) => ({
      id: r.id,

      entityId,
      uid: userIdSafe,

      transactionId: txId,

      transactionType: "initial_balance",   // ✅ FIX
      documentNature: "opening",            // ✅ FIX

      account_code: r.account_code,
      account_name: r.account_name,

      debit: Number(r.debit ?? 0),
      credit: Number(r.credit ?? 0),

      date,
      description,

      invoice_number: "MANUAL",
      documentId: txId,

      source: "manual",
      isManual: true,

      createdAt: r.createdAt ?? Date.now(),

      issuerRUC: issuerRUC || undefined,
      supplier_name: supplierName || undefined,
    }));

    try {
      await onAddEntries(cleaned);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error al guardar asiento.");
      setIsSaving(false);
    }
  };

  /* =============================================================================
     UI (minimal)
  ============================================================================= */

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <Rnd
        default={{ x: 100, y: 80, width: 900, height: "auto" }}
        bounds="window"
        enableResizing={false}
        className="bg-white rounded-xl shadow-xl"
      >
        <div ref={modalRef} className="p-6">

          <h2 className="text-xl font-semibold mb-4">
            ✍ Ingreso manual
          </h2>

          <button
            onClick={handleSave}
            disabled={!isBalanced || isSaving}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            {isSaving ? "Guardando..." : "Guardar"}
          </button>

        </div>
      </Rnd>
    </div>,
    document.body
  );
}