// ============================================================================
// src/pages/CashFlowPage.tsx
// CONTILISTO — Estado de Flujo de Efectivo
// Formato Superintendencia de Compañías del Ecuador (Método Directo)
//
// Sections:
//   I.  Actividades de Operación
//   II. Actividades de Inversión
//   III.Actividades de Financiamiento
//   IV. Sin clasificar
//   ─── Variación neta en efectivo
//   ─── Saldo inicial de efectivo
//   ─── Saldo final de efectivo
// ============================================================================

import React, { useEffect, useState, useMemo } from "react";
import { getRealCashFlow, getRealCashBeforeDate } from "@/services/cashFlowRealService";
import { fetchBankAccountsFromCOA } from "@/services/coaService";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import type { RealCashflowEvent } from "@/services/cashFlowRealService";
import type { CashflowCategory } from "@/types/UnifiedCashflow";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const USD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const currentYear = new Date().getFullYear();

function defaultPeriod() {
  return {
    from: `${currentYear}-01-01`,
    to: new Date().toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// SECTION CONFIG
// ---------------------------------------------------------------------------

interface SectionDef {
  id: CashflowCategory;
  label: string;
  roman: string;
  color: string;
  bg: string;
}

const SECTIONS: SectionDef[] = [
  {
    id: "operating",
    label: "Actividades de Operación",
    roman: "I.",
    color: "text-blue-800",
    bg: "bg-blue-50",
  },
  {
    id: "investing",
    label: "Actividades de Inversión",
    roman: "II.",
    color: "text-emerald-800",
    bg: "bg-emerald-50",
  },
  {
    id: "financing",
    label: "Actividades de Financiamiento",
    roman: "III.",
    color: "text-purple-800",
    bg: "bg-purple-50",
  },
  {
    id: "uncategorized",
    label: "Sin clasificar",
    roman: "IV.",
    color: "text-gray-600",
    bg: "bg-gray-50",
  },
];

// ---------------------------------------------------------------------------
// SUB-COMPONENTS
// ---------------------------------------------------------------------------

function SectionBlock({
  section,
  events,
  bankNames,
}: {
  section: SectionDef;
  events: RealCashflowEvent[];
  bankNames: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);

  const inflows  = events.filter((e) => e.amount > 0);
  const outflows = events.filter((e) => e.amount < 0);
  const net      = events.reduce((s, e) => s + e.amount, 0);
  const totalIn  = inflows.reduce((s, e) => s + e.amount, 0);
  const totalOut = outflows.reduce((s, e) => s + e.amount, 0);

  if (events.length === 0 && section.id === "uncategorized") return null;

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Section header */}
      <div className={`${section.bg} px-5 py-3 flex items-center justify-between`}>
        <span className={`font-bold text-sm ${section.color}`}>
          {section.roman} {section.label}
        </span>
        <div className="flex items-center gap-4">
          <span className={`font-bold text-base ${net >= 0 ? "text-green-700" : "text-red-700"}`}>
            {USD(net)}
          </span>
          {events.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              {expanded ? "Ocultar" : `Ver ${events.length} movimiento${events.length !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>

      {/* Summary lines */}
      <div className="px-5 py-2 bg-white border-b text-sm divide-y">
        <SummaryLine label="Entradas de efectivo" amount={totalIn} positive />
        <SummaryLine label="Salidas de efectivo"  amount={totalOut} />
      </div>

      {/* Movement detail */}
      {expanded && events.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500 font-medium w-28">Fecha</th>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Descripción</th>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Cuenta bancaria</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium w-32">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-1.5 text-gray-600">{e.date}</td>
                  <td className="px-4 py-1.5 text-gray-800">{e.description}</td>
                  <td className="px-4 py-1.5 text-gray-600">
                    {bankNames[e.bankAccountId] ?? e.bankAccountId ?? "—"}
                  </td>
                  <td
                    className={`px-4 py-1.5 text-right font-semibold tabular-nums ${
                      e.amount >= 0 ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {USD(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {events.length === 0 && (
        <div className="px-5 py-3 text-xs text-gray-400 bg-white">
          Sin movimientos en el período
        </div>
      )}
    </div>
  );
}

function SummaryLine({
  label,
  amount,
  positive = false,
}: {
  label: string;
  amount: number;
  positive?: boolean;
}) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-gray-600">{label}</span>
      <span className={`tabular-nums font-medium ${positive ? "text-green-700" : "text-red-600"}`}>
        {USD(Math.abs(amount))}
      </span>
    </div>
  );
}

function TotalRow({
  label,
  amount,
  highlight = false,
  indent = false,
}: {
  label: string;
  amount: number;
  highlight?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center px-5 py-3 ${
        highlight
          ? "bg-[#0A3558] text-white rounded-xl"
          : "border-b last:border-0"
      } ${indent ? "pl-10" : ""}`}
    >
      <span className={`font-semibold text-sm ${highlight ? "text-white" : "text-gray-800"}`}>
        {label}
      </span>
      <span
        className={`font-bold text-base tabular-nums ${
          highlight
            ? "text-white"
            : amount >= 0
            ? "text-green-700"
            : "text-red-600"
        }`}
      >
        {USD(amount)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN PAGE
// ---------------------------------------------------------------------------

export default function CashFlowPage() {
  const { selectedEntity } = useSelectedEntity();
  const entityId = selectedEntity?.id ?? "";

  const [from, setFrom] = useState(defaultPeriod().from);
  const [to,   setTo]   = useState(defaultPeriod().to);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const [events,       setEvents]       = useState<RealCashflowEvent[]>([]);
  const [openingCash,  setOpeningCash]  = useState<number>(0);
  const [bankNames,    setBankNames]    = useState<Record<string, string>>({});

  // ── Load bank account names once ─────────────────────────────────────────
  useEffect(() => {
    if (!entityId) return;
    fetchBankAccountsFromCOA(entityId)
      .then((accounts) => {
        const map: Record<string, string> = {};
        for (const a of accounts) {
          // bankAccountId on movements stores the account code (e.g. "101010301")
          if (a.code) map[a.code] = a.name;
        }
        setBankNames(map);
      })
      .catch(() => {});
  }, [entityId]);

  // ── Load cash flow data ───────────────────────────────────────────────────
  useEffect(() => {
    if (!entityId) { setEvents([]); return; }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [res, opening] = await Promise.all([
          getRealCashFlow(entityId, from || undefined, to || undefined),
          from ? getRealCashBeforeDate(entityId, from) : Promise.resolve(0),
        ]);
        if (cancelled) return;
        setEvents(res.events);
        setOpeningCash(opening);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Error cargando flujo de efectivo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [entityId, from, to]);

  // ── Derived totals ────────────────────────────────────────────────────────
  const byCategory = useMemo(() => {
    const map: Record<CashflowCategory, RealCashflowEvent[]> = {
      operating:     [],
      investing:     [],
      financing:     [],
      uncategorized: [],
    };
    for (const e of events) map[e.category].push(e);
    return map;
  }, [events]);

  const netByCategory = useMemo(
    () => ({
      operating:     byCategory.operating.reduce((s, e) => s + e.amount, 0),
      investing:     byCategory.investing.reduce((s, e) => s + e.amount, 0),
      financing:     byCategory.financing.reduce((s, e) => s + e.amount, 0),
      uncategorized: byCategory.uncategorized.reduce((s, e) => s + e.amount, 0),
    }),
    [byCategory]
  );

  const netChange   = Object.values(netByCategory).reduce((s, v) => s + v, 0);
  const closingCash = openingCash + netChange;

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!entityId) {
    return (
      <div className="p-6 text-gray-500">
        Selecciona una empresa para ver el flujo de efectivo.
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Estado de Flujo de Efectivo</h1>
          <p className="text-sm text-gray-500">
            {selectedEntity?.name} · Método Directo · NIC 7 / Supercias
          </p>
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500">Desde</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500">Hasta</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={() => { const p = defaultPeriod(); setFrom(p.from); setTo(p.to); }}
            className="text-xs text-blue-600 hover:underline"
          >
            YTD {currentYear}
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-sm text-gray-500 animate-pulse">
          Cargando movimientos…
        </div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && (
        <>
          {/* ── KPI ribbon ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SECTIONS.filter((s) => s.id !== "uncategorized").map((s) => {
              const v = netByCategory[s.id];
              return (
                <div key={s.id} className={`${s.bg} rounded-xl p-4 border`}>
                  <div className={`text-xs font-medium ${s.color} mb-1`}>{s.label}</div>
                  <div className={`text-lg font-bold tabular-nums ${v >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {USD(v)}
                  </div>
                </div>
              );
            })}
            <div className="bg-[#0A3558] rounded-xl p-4 border">
              <div className="text-xs font-medium text-blue-200 mb-1">Variación neta</div>
              <div className={`text-lg font-bold tabular-nums ${netChange >= 0 ? "text-green-300" : "text-red-300"}`}>
                {USD(netChange)}
              </div>
            </div>
          </div>

          {/* ── Three activity sections ── */}
          <div className="space-y-3">
            {SECTIONS.map((s) => (
              <SectionBlock
                key={s.id}
                section={s}
                events={byCategory[s.id]}
                bankNames={bankNames}
              />
            ))}
          </div>

          {/* ── Net change + opening + closing ── */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <TotalRow
              label="Variación neta en efectivo del período"
              amount={netChange}
            />
            <TotalRow
              label="Saldo inicial de efectivo"
              amount={openingCash}
            />
            <TotalRow
              label="Saldo final de efectivo"
              amount={closingCash}
              highlight
            />
          </div>

          {/* ── No data message ── */}
          {events.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-400 text-sm">
              No hay movimientos bancarios en el período seleccionado.<br />
              Registra movimientos en el <span className="font-medium">Libro Bancos</span> para ver el flujo de efectivo.
            </div>
          )}
        </>
      )}
    </div>
  );
}
