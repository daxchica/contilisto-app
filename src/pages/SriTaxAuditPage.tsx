// ============================================================================
// src/pages/SriTaxAuditPage.tsx
// ============================================================================

import { useState, useMemo } from "react";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { getIvaVentasLedger, getIvaComprasLedger } from "@/services/sri/taxAuditService";
import type { JournalEntry } from "@/types/JournalEntry";

type Props = {
  entries: JournalEntry[];
};

export default function SriTaxAuditPage({ entries }: Props) {

  const { selectedEntity } = useSelectedEntity();

  const [period, setPeriod] = useState("2026-03");

  const ventasLedger = useMemo(() => {
    if (!selectedEntity?.id) return [];
    return getIvaVentasLedger(entries, selectedEntity.id, period);
  }, [entries, selectedEntity?.id, period]);

  const comprasLedger = useMemo(() => {
    if (!selectedEntity?.id) return [];
    return getIvaComprasLedger(entries, selectedEntity.id, period);
  }, [entries, selectedEntity?.id, period]);

  return (

    <div className="space-y-6">

      <div className="bg-white p-6 rounded shadow">

        <h1 className="text-xl font-bold">
          Auditoría Tributaria SRI
        </h1>

        <input
          type="month"
          inputMode="numeric"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="border rounded px-3 py-1 mt-3"
        />

      </div>

      {/* Replace with your ledger components */}

      <pre>{JSON.stringify(ventasLedger, null, 2)}</pre>
      <pre>{JSON.stringify(comprasLedger, null, 2)}</pre>

    </div>
  );
}