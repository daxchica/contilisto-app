// ============================================================================
// src/pages/Declaraciones.tsx
// CONTILISTO — SRI Declarations Dashboard (PRODUCTION IMPROVED)
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

import { getDeclarationStatuses } from "@/services/sri/declarationStatusService";
import { runTaxEngine, TaxEngineResult } from "@/services/sri/taxEngineService";

import Iva104PreviewModal from "@/components/sri/Iva104PreviewModal";
import AtsPreviewModal from "@/components/sri/AtsPreviewModal";
import Ret103PreviewModal from "@/components/sri/Ret103PreviewModal";

import { generateIva104 } from "@/services/sri/generateIva104";
import { generateAtsXml } from "@/services/sri/generateAtsXml";

import { fetchJournalEntries } from "@/services/journalService";
import { buildAtsDocuments } from "@/services/sri/atsDocumentAggregator";
import { generateRet103Summary } from "@/services/sri/generateRet103";

import type { JournalEntry } from "@/types/JournalEntry";
import type { AtsDocument } from "@/types/atsDocument";

// ============================================================================
// TYPES
// ============================================================================

type DeclarationStatus = {
  module: "iva104" | "ret103" | "ats";
  status: "pending" | "ready" | "generated";
};

type ActionKey = "iva" | "ret103" | "atsPreview" | "atsDownload" | null;

// ============================================================================
// UI CARD
// ============================================================================

interface DeclarationCardProps {
  title: string;
  description: string;
  status?: "pending" | "ready" | "generated";
  primaryLabel: string;
  secondaryLabel: string;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
  primaryDisabled?: boolean;
  secondaryDisabled?: boolean;
}

function DeclarationCard({
  title,
  description,
  status = "pending",
  primaryLabel,
  secondaryLabel,
  onPrimaryClick,
  onSecondaryClick,
  primaryDisabled = false,
  secondaryDisabled = false,
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
          disabled={primaryDisabled}
          className={`px-3 py-1 rounded text-white transition ${
            primaryDisabled
              ? "bg-blue-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {primaryLabel}
        </button>

        <button
          onClick={onSecondaryClick}
          disabled={secondaryDisabled}
          className={`px-3 py-1 border rounded transition ${
            secondaryDisabled
              ? "text-gray-400 border-gray-200 cursor-not-allowed"
              : "hover:bg-gray-50"
          }`}
        >
          {secondaryLabel}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function Declaraciones() {
  const { selectedEntity } = useSelectedEntity();
  const entityId = selectedEntity?.id ?? null;

  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const [taxEngineResult, setTaxEngineResult] = useState<TaxEngineResult | null>(null);

  const [ivaSummary, setIvaSummary] = useState<any | null>(null);
  const [showIvaPreview, setShowIvaPreview] = useState(false);

  const [atsDocuments, setAtsDocuments] = useState<AtsDocument[]>([]);
  const [showAtsPreview, setShowAtsPreview] = useState(false);

  const [retSummary, setRetSummary] = useState<any | null>(null);
  const [showRetPreview, setShowRetPreview] = useState(false);

  const [activeAction, setActiveAction] = useState<ActionKey>(null);

  const period = useMemo(() => `${year}-${month}`, [year, month]);

  const periodEntries = useMemo(() => {
    if (!entityId) return [];
    return entries.filter(
      (e) => e.entityId === entityId && e.date?.slice(0, 7) === period
    );
  }, [entries, entityId, period]);

  const hasEntity = Boolean(entityId);
  const safeEntityId = entityId as string;
  const hasPeriodEntries = periodEntries.length > 0;

  // ==========================================================================
  // LOAD JOURNAL ENTRIES
  // ==========================================================================

  useEffect(() => {
    if (!safeEntityId) {
      setEntries([]);
      return;
    }

    let cancelled = false;
    setLoadingEntries(true);

    async function loadEntries() {
      try {
        const data = await fetchJournalEntries(safeEntityId);
        if (!cancelled) {
          setEntries(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Error loading journal entries:", err);
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoadingEntries(false);
      }
    }

    loadEntries();

    return () => {
      cancelled = true;
    };
  }, [safeEntityId]);

  useEffect(() => {
    console.log("🔥 ENTRIES COUNT:", entries.length);
    console.log("🔥 SAMPLE ENTRY:", entries[0]);
  }, [entries]);

  // ==========================================================================
  // TAX ENGINE
  // ==========================================================================

  useEffect(() => {
    if (!safeEntityId) {
      setTaxEngineResult(null);
      return;
    }

    const safesafeEntityId = safeEntityId;

    let cancelled = false;

    async function runEngine() {
      const result = await runTaxEngine(
        entries,
        safesafeEntityId,
        period
      );

      if (!cancelled) setTaxEngineResult(result);
    }

    runEngine();

    return () => {
      cancelled = true;
    };
  }, [entries, safeEntityId, period]);

  // ==========================================================================
  // DECLARATION STATUS
  // ==========================================================================

  const statuses: DeclarationStatus[] = useMemo(() => {
    if (!safeEntityId) return [];

    return getDeclarationStatuses(entries, safeEntityId, period);
  }, [entries, safeEntityId, period]);

  const ivaStatus = statuses.find((s) => s.module === "iva104");
  const retStatus = statuses.find((s) => s.module === "ret103");
  const atsStatus = statuses.find((s) => s.module === "ats");

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  async function handleGenerateIva() {
    if (!entityId) {
      alert("Seleccione una empresa.");
      return;
    }

    if (!hasPeriodEntries) {
      alert("No existen transacciones contables en este periodo.");
      return;
    }

    const safeEntityId = entityId;

    setActiveAction("iva");
    try {
      const summary = await generateIva104(
        entries, 
        safeEntityId, 
        period
      );

      setIvaSummary(summary);
      setShowIvaPreview(true);
    } catch (err) {
      console.error("Error generating IVA 104:", err);
      alert("No se pudo generar el formulario 104.");
    } finally {
      setActiveAction(null);
    }
  }

  function handleViewIva() {
    if (ivaSummary) {
      setShowIvaPreview(true);
      return;
    }

    if (taxEngineResult?.ivaSummary) {
      setIvaSummary(taxEngineResult.ivaSummary);
      setShowIvaPreview(true);
      return;
    }

    if (!hasPeriodEntries) {
      alert("No existen transacciones contables en este periodo.");
      return;
    }

    alert("Primero genere el formulario 104.");
  }

  async function handleGenerateRet103() {
    if (!entityId) {
      alert("Seleccione una empresa.");
      return;
    }

    if (!hasPeriodEntries) {
      alert("No existen transacciones contables en este periodo.");
      return;
    }

    const safeEntityId = entityId;

    setActiveAction("ret103");
    
    try {
      const summary = generateRet103Summary(
        taxEngineResult!.ledger, 
        safeEntityId, 
        period
      );

      setRetSummary(summary);
      setShowRetPreview(true);
    } catch (err) {
      console.error("Error generating Form 103:", err);
      alert("No se pudo generar el formulario 103.");
    } finally {
      setActiveAction(null);
    }
  }

  function handleViewRet103() {
    if (retSummary) {
      setShowRetPreview(true);
      return;
    }

    if (!hasPeriodEntries) {
      alert("No existen transacciones contables en este periodo.");
      return;
    }

    alert("Primero genere el formulario 103.");
  }

  async function handleGenerateAtsPreview() {
    if (!entityId || !selectedEntity) {
      alert("Seleccione una empresa.");
      return;
    }

    const safeEntityId = entityId;

    setActiveAction("atsPreview");
    try {
      const docs = buildAtsDocuments(
        taxEngineResult!.ledger, 
        safeEntityId, 
        period
      );

      if (!docs.length) {
        alert("No existen documentos para generar ATS en este periodo.");
        return;
      }

      setAtsDocuments(docs);
      setShowAtsPreview(true);
    } catch (err) {
      console.error("Error preparing ATS preview:", err);
      alert("No se pudo preparar el ATS.");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleExportAtsXml() {
    if (!entityId || !selectedEntity) {
      alert("Seleccione una empresa.");
      return;
    }

    const safeEntityId = entityId;

    setActiveAction("atsDownload");
    
    try {
      const xml = await generateAtsXml({
        ledger: taxEngineResult!.ledger,
        entityId: safeEntityId,
        period,
        ruc: selectedEntity.ruc ?? "",
        razonSocial: selectedEntity.name ?? "",
      });

      if (!xml?.trim()) {
        alert("No se pudo generar el XML del ATS.");
        return;
      }

      const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `ATS-${period}.xml`;
      link.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting ATS XML:", err);
      alert("No se pudo descargar el XML del ATS.");
    } finally {
      setActiveAction(null);
    }
  }

  // ==========================================================================
  // UI
  // ==========================================================================

  if (!hasEntity) {
    return (
      <div className="bg-white p-6 rounded-xl shadow text-center text-gray-500">
        Seleccione una empresa para continuar.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold text-[#0A3558]">
          Declaraciones SRI
        </h1>

        <div className="mt-4 flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border rounded px-3 py-1"
          >
            {[
              ["01", "Enero"], ["02", "Febrero"], ["03", "Marzo"], ["04", "Abril"],
              ["05", "Mayo"], ["06", "Junio"], ["07", "Julio"], ["08", "Agosto"],
              ["09", "Septiembre"], ["10", "Octubre"], ["11", "Noviembre"], ["12", "Diciembre"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border rounded px-3 py-1"
          >
            {Array.from({ length: 6 }).map((_, i) => {
              const y = new Date().getFullYear() - i;
              return (
                <option key={y} value={y}>
                  {y}
                </option>
              );
            })}
          </select>
        </div>

        <div className="mt-3 text-sm text-gray-500">
          Período seleccionado: {month}/{year}
        </div>

        {loadingEntries && (
          <div className="mt-3 text-sm text-blue-600">
            Cargando registros contables...
          </div>
        )}

        {!loadingEntries && !hasPeriodEntries && (
          <div className="mt-3 text-sm text-amber-600">
            No existen movimientos para el período seleccionado.
          </div>
        )}

        {!!taxEngineResult?.validation?.errors?.length && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="font-semibold mb-1">Validaciones del motor tributario</div>
            <ul className="list-disc pl-5 space-y-1">
              {taxEngineResult.validation.errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <DeclarationCard
          title="IVA - Formulario 104"
          description="Declaración mensual del IVA."
          status={ivaStatus?.status ?? "pending"}
          primaryLabel={activeAction === "iva" ? "Generando..." : "Generar"}
          secondaryLabel="Ver"
          onPrimaryClick={handleGenerateIva}
          onSecondaryClick={handleViewIva}
          primaryDisabled={loadingEntries || activeAction !== null}
          secondaryDisabled={loadingEntries || (!ivaSummary && !taxEngineResult?.ivaSummary)}
        />

        <DeclarationCard
          title="Retenciones - Formulario 103"
          description="Declaración mensual de retenciones."
          status={retStatus?.status ?? "pending"}
          primaryLabel={activeAction === "ret103" ? "Generando..." : "Generar"}
          secondaryLabel="Ver"
          onPrimaryClick={handleGenerateRet103}
          onSecondaryClick={handleViewRet103}
          primaryDisabled={loadingEntries || activeAction !== null}
          secondaryDisabled={loadingEntries || !retSummary}
        />

        <DeclarationCard
          title="ATS"
          description="Anexo Transaccional Simplificado (XML)."
          status={atsStatus?.status ?? "pending"}
          primaryLabel={activeAction === "atsPreview" ? "Generando..." : "Generar XML"}
          secondaryLabel={activeAction === "atsDownload" ? "Descargando..." : "Descargar"}
          onPrimaryClick={handleGenerateAtsPreview}
          onSecondaryClick={handleExportAtsXml}
          primaryDisabled={loadingEntries || activeAction !== null}
          secondaryDisabled={loadingEntries || activeAction !== null || !hasPeriodEntries}
        />
      </div>

      <Ret103PreviewModal
        open={showRetPreview}
        summary={retSummary}
        onClose={() => setShowRetPreview(false)}
      />

      <Iva104PreviewModal
        open={showIvaPreview}
        onClose={() => setShowIvaPreview(false)}
        summary={ivaSummary}
      />

      <AtsPreviewModal
        open={showAtsPreview}
        documents={atsDocuments}
        onClose={() => setShowAtsPreview(false)}
        onExportXml={handleExportAtsXml}
      />
    </div>
  );
}