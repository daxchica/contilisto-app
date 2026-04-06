// ============================================================================
// src/pages/DeclaracionesIvaPage.tsx
// CONTILISTO — IVA 104 PAGE (PRODUCTION READY)
// ============================================================================

import React, { useMemo, useState, useEffect } from "react";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { useAuth } from "@/context/AuthContext";

import type { JournalEntry } from "@/types/JournalEntry";

import { buildIva104Summary } from "@/services/sri/iva104Service";
import { fetchJournalEntries } from "@/services/journalService";

/* -------------------------------------------------------------------------- */
/* FORMATTERS                                                                 */
/* -------------------------------------------------------------------------- */

const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function DeclaracionesIvaPage() {
  const { selectedEntity } = useSelectedEntity();
  const { user } = useAuth();

  /* -------------------------------------------------------------------------- */
  /* STATE                                                                      */
  /* -------------------------------------------------------------------------- */

  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(
    String(now.getMonth() + 1).padStart(2, "0")
  );

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const period = `${year}-${month}`;

  const entityId = selectedEntity?.id ?? null;

  /* -------------------------------------------------------------------------- */
  /* LOAD ENTRIES                                                               */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    if (!entityId) {
      setEntries([]);
      return;
    }

    const safeEntityId = entityId;

    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const data = await fetchJournalEntries(safeEntityId);

        if (!cancelled) {
          setEntries(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Error loading journal entries:", err);
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [entityId]);

  /* -------------------------------------------------------------------------- */
  /* ACCOUNT MAP (ECUADOR LOGIC BASE)                                           */
  /* -------------------------------------------------------------------------- */

  const accountMap = useMemo(
    () => ({
      // SALES
      ventas12: ["4"],
      ventas0: [],

      // IVA SALES
      ivaVentas: ["20102"],

      // PURCHASES
      compras12: ["5"],
      compras0: [],

      // IVA CREDIT
      ivaCompras: ["133"],

      // IVA RETENTIONS
      retIvaRecibidas: ["113"],

    }),
    []
  );

  /* -------------------------------------------------------------------------- */
  /* SUMMARY                                                                    */
  /* -------------------------------------------------------------------------- */

  const summary = useMemo(() => {
    if (!entityId) {
      return {
        ventas12: 0,
        ventas0: 0,
        ivaVentas: 0,
        compras12: 0,
        compras0: 0,
        ivaCompras: 0,
        retIvaRecibidas: 0,
        saldoCreditoAnterior: 0,
        totalCredito: 0,
        ivaPagar: 0,
        saldoArrastrar: 0,
        warnings: ["Seleccione una entidad"],
      };
    }

    return buildIva104Summary({
      entries,
      entityId,
      period,
      accountMap,
    });
  }, [entries, entityId, period, accountMap]);

  /* -------------------------------------------------------------------------- */
  /* FLAGS                                                                      */
  /* -------------------------------------------------------------------------- */

  const hasData = entries.length > 0;

  /* -------------------------------------------------------------------------- */
  /* UI                                                                         */
  /* -------------------------------------------------------------------------- */

  if (!selectedEntity) {
    return (
      <div className="bg-white p-6 rounded-xl shadow text-center text-gray-500">
        Seleccione una empresa para continuar.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold text-[#0A3558]">
          IVA - Formulario 104
        </h1>

        <p className="text-gray-600 mt-2">
          Vista previa de la declaración mensual de IVA.
        </p>

        {/* PERIOD */}

        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">
            Periodo
          </label>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border rounded px-3 py-2"
          >
            {Array.from({ length: 5 }).map((_, i) => {
              const y = new Date().getFullYear() - i;
              return <option key={y}>{y}</option>;
            })}
          </select>

          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border rounded px-3 py-2"
          >
            {[
              ["01","Enero"],["02","Febrero"],["03","Marzo"],
              ["04","Abril"],["05","Mayo"],["06","Junio"],
              ["07","Julio"],["08","Agosto"],["09","Septiembre"],
              ["10","Octubre"],["11","Noviembre"],["12","Diciembre"],
            ].map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="text-sm text-gray-500 mt-2">
          Período: {month}/{year}
        </div>

        {loading && (
          <div className="mt-3 text-sm text-blue-600">
            Cargando registros contables...
          </div>
        )}

        {!loading && !hasData && (
          <div className="mt-3 text-sm text-amber-600">
            No existen movimientos contables en este período.
          </div>
        )}
      </div>

      {/* WARNINGS */}

      {summary.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="font-semibold mb-2">Validaciones</h2>
          <ul className="list-disc pl-5">
            {summary.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* DATA CARDS */}

      <div className="grid md:grid-cols-2 gap-4">
        {/* SALES */}

        <div className="bg-white p-5 rounded-xl shadow border">
          <h3 className="font-bold text-lg mb-3">Ventas</h3>

          <div className="space-y-2 text-sm">
            <Row label="Ventas 12%" value={summary.ventas12} />
            <Row label="Ventas 0%" value={summary.ventas0} />
            <Row label="IVA generado" value={summary.ivaVentas} bold />
          </div>
        </div>

        {/* PURCHASES */}

        <div className="bg-white p-5 rounded-xl shadow border">
          <h3 className="font-bold text-lg mb-3">
            Crédito tributario
          </h3>

          <div className="space-y-2 text-sm">
            <Row label="Compras 12%" value={summary.compras12} />
            <Row label="IVA compras" value={summary.ivaCompras} />
            <Row label="Retenciones IVA aplicadas" value={summary.retIvaRecibidas} bold />
            <Row label="Retenciones IVA" value={summary.retIvaRecibidas} />
            <Row label="Total crédito" value={summary.totalCredito} bold />
          </div>
        </div>
      </div>

      {/* RESULT */}

      <div className="bg-white p-6 rounded-xl shadow border">
        <h3 className="font-bold text-lg mb-4">
          Resultado del período
        </h3>

        <div className="grid md:grid-cols-2 gap-4">
          <ResultCard
            label="IVA a pagar"
            value={summary.ivaPagar}
            color="red"
          />

          <ResultCard
            label="Saldo a favor"
            value={summary.saldoArrastrar}
            color="green"
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SMALL UI COMPONENTS                                                        */
/* -------------------------------------------------------------------------- */

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold border-t pt-2" : ""}`}>
      <span>{label}</span>
      <span>{money.format(value)}</span>
    </div>
  );
}

function ResultCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "red" | "green";
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold text-${color}-600`}>
        {money.format(value)}
      </div>
    </div>
  );
}