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

        <div className="flex gap-2 mt-3">

          {/* YEAR */}
          <select
            value={period.slice(0, 4)}
            onChange={(e) => {
              const year = e.target.value;
              const month = period.slice(5, 7);
              setPeriod(`${year}-${month}`);
            }}
            className="border rounded px-3 py-1"
          >
            {Array.from({ length: 5 }, (_, i) => {
              const y = new Date().getFullYear() - i;
              return (
                <option key={y} value={y}>
                  {y}
                </option>
              );
            })}
          </select>

          {/* MONTH */}
          <select
            value={period.slice(5, 7)}
            onChange={(e) => {
              const month = e.target.value;
              const year = period.slice(0, 4);
              setPeriod(`${year}-${month}`);
            }}
            className="border rounded px-3 py-1"
          >
            {[
              ["01", "Enero"],
              ["02", "Febrero"],
              ["03", "Marzo"],
              ["04", "Abril"],
              ["05", "Mayo"],
              ["06", "Junio"],
              ["07", "Julio"],
              ["08", "Agosto"],
              ["09", "Septiembre"],
              ["10", "Octubre"],
              ["11", "Noviembre"],
              ["12", "Diciembre"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

        </div>

      </div>

      {/* Replace with your ledger components */}

      <pre>{JSON.stringify(ventasLedger, null, 2)}</pre>
      <pre>{JSON.stringify(comprasLedger, null, 2)}</pre>

    </div>
  );
}