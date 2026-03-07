// ============================================================================
// src/pages/Declaraciones.tsx
// CONTILISTO — SRI Declarations Dashboard
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { getDeclarationStatuses } from "@/services/sri/declarationStatusService";
import { runTaxEngine, TaxEngineResult } from "@/services/sri/taxEngineService";
import Iva104PreviewModal from "@/components/sri/Iva104PreviewModal";
import { generateIva104 } from "@/services/sri/generateIva104";

import type { JournalEntry } from "@/types/JournalEntry";

type Props = {
  entries: JournalEntry[];
};

type DeclarationStatus = {
  module: "iva104" | "ret103" | "ats";
  status: "pending" | "ready" | "generated";
};

interface DeclarationCardProps {
  title: string;
  description: string;
  status?: "pending" | "ready" | "generated";
  primaryLabel: string;
  secondaryLabel: string;
  onPrimaryClick?: () => void;
}

function DeclarationCard({
  title,
  description,
  status = "pending",
  primaryLabel,
  secondaryLabel,
  onPrimaryClick,
}: DeclarationCardProps) {

  const statusColor =
    status === "ready"
      ? "text-green-600"
      : status === "generated"
      ? "text-blue-600"
      : "text-yellow-600";

  const statusText =
    status === "ready"
      ? "Listo"
      : status === "generated"
      ? "Generado"
      : "Pendiente";

  return (
    <div className="bg-white p-5 rounded-xl shadow border">
      <h3 className="font-bold text-lg text-[#0A3558]">{title}</h3>

      <p className="text-sm text-gray-600 mt-2">{description}</p>

      <div className="mt-4 text-sm">
        Estado: <span className={`font-semibold ${statusColor}`}>{statusText}</span>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onPrimaryClick} 
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
          {primaryLabel}
        </button>

        <button className="px-3 py-1 border rounded hover:bg-gray-50">
          {secondaryLabel}
        </button>
      </div>
    </div>
  );
}

export default function Declaraciones({ entries }: Props) {

  const { selectedEntity } = useSelectedEntity();

  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());

  const [showIvaPreview, setShowIvaPreview] = useState(false);
  const [ivaSummary, setIvaSummary] = useState<any | null>(null);

  const [month, setMonth] = useState(
    String(now.getMonth() + 1).padStart(2, "0")
  );

  const [taxEngineResult, setTaxEngineResult] =
    useState<TaxEngineResult | null>(null);

  const period = useMemo(() => `${year}-${month}`, [year, month]);

  const entityId: string | null = selectedEntity?.id ?? null;

  // --------------------------------------------------------------------------
  // RUN TAX ENGINE
  // --------------------------------------------------------------------------

  useEffect(() => {

    if (entityId === null) return;

    const safeEntityId: string = entityId;

    let cancelled = false;

    async function runEngine() {

      const result = await runTaxEngine(
        entries,
        safeEntityId,
        period
      );

      if (!cancelled) {
        setTaxEngineResult(result);
      }
    }

    runEngine();

    return () => {
      cancelled = true;
    };

  }, [entries, entityId, period]);

  // --------------------------------------------------------------------------
  // DECLARATION STATUS
  // --------------------------------------------------------------------------

  const statuses: DeclarationStatus[] = useMemo(() => {

    if (entityId === null ) return [];

    const safeEntityId: string = entityId;

    return getDeclarationStatuses(
      entries,
      safeEntityId,
      period
    );

  }, [entries, entityId, period]);

  const ivaStatus = statuses.find(s => s.module === "iva104");
  const retStatus = statuses.find(s => s.module === "ret103");
  const atsStatus = statuses.find(s => s.module === "ats");

  // --------------------------------------------------------------------------
// IVA GENERATOR
// --------------------------------------------------------------------------

async function handleGenerateIva() {

  if (!entityId) return;

  const safeEntries = Array.isArray(entries) ? entries : [];

  const periodEntries = safeEntries.filter(e =>
    e.date && e.date.slice(0, 7) === period
  );

  if (periodEntries.length === 0) {
    alert("No existen transacciones contables en este periodo.");
    return;
  }

  const summary = await generateIva104(
    safeEntries,
    entityId,
    period
  );

  setIvaSummary(summary);
  setShowIvaPreview(true);
}

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="bg-white p-6 rounded-xl shadow">

        <h1 className="text-2xl font-bold text-[#0A3558]">
          Declaraciones SRI
        </h1>

        <p className="text-gray-600 mt-2">
          Generación automática de formularios tributarios del SRI usando la
          información contable registrada.
        </p>

        <div className="mt-4 flex items-center gap-2">

          <label className="text-sm font-semibold text-gray-700">
            Periodo:
          </label>

          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border rounded px-3 py-1"
          >
            {[
              ["01","Enero"],["02","Febrero"],["03","Marzo"],["04","Abril"],
              ["05","Mayo"],["06","Junio"],["07","Julio"],["08","Agosto"],
              ["09","Septiembre"],["10","Octubre"],["11","Noviembre"],["12","Diciembre"]
            ].map(([value,label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border rounded px-3 py-1"
          >
            {Array.from({ length: 6 }).map((_, i) => {
              const y = new Date().getFullYear() - i;
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>

          <div className="ml-3 text-xs text-gray-500">
            Periodo fiscal: <span className="font-mono">{period}</span>
          </div>

        </div>

      </div>

      {/* DECLARATION MODULES */}

      <div className="grid md:grid-cols-3 gap-4">

        <DeclarationCard
          title="IVA - Formulario 104"
          description="Declaración mensual del IVA."
          status={ivaStatus?.status ?? "pending"}
          primaryLabel="Generar"
          secondaryLabel="Ver"
          onPrimaryClick={handleGenerateIva}
        />

        <DeclarationCard
          title="Retenciones - Formulario 103"
          description="Declaración mensual de retenciones."
          status={retStatus?.status ?? "pending"}
          primaryLabel="Generar"
          secondaryLabel="Ver"
        />

        <DeclarationCard
          title="ATS"
          description="Anexo Transaccional Simplificado (XML)."
          status={atsStatus?.status ?? "pending"}
          primaryLabel="Generar XML"
          secondaryLabel="Descargar"
        />

      </div>

      <Iva104PreviewModal
        open={showIvaPreview}
        onClose={() => setShowIvaPreview(false)}
        summary={ivaSummary}
      />
    </div>
  );
}