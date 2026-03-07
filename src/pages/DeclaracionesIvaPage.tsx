// src/pages/DeclaracionesIvaPage.tsx

import React, { useMemo, useState } from "react";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { useAuth } from "@/context/AuthContext";
import type { JournalEntry } from "@/types/JournalEntry";
import { buildIva104Summary } from "@/services/sri/iva104Service";

type Props = {
  entries: JournalEntry[];
};

const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export default function DeclaracionesIvaPage({ entries }: Props) {
  const { selectedEntity } = useSelectedEntity();
  const { user } = useAuth();

  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Temporary mapping: replace these with your real Ecuador COA codes.
  const accountMap = useMemo(
    () => ({
      ventas12: ["40101", "40102"],
      ventas0: ["40103"],
      ivaVentas: ["240801"],
      compras12: ["50101", "60101"],
      compras0: ["50102", "60102"],
      ivaCompras: ["120201"],
      retIvaRecibidas: ["120301"],
    }),
    []
  );

  const summary = useMemo(() => {
    return buildIva104Summary({
      entries,
      entityId: selectedEntity?.id,
      period,
      accountMap,
    });
  }, [entries, selectedEntity?.id, period, accountMap]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold text-[#0A3558]">
          IVA - Formulario 104
        </h1>
        <p className="text-gray-600 mt-2">
          Vista previa de la declaración mensual de IVA del período seleccionado.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Periodo</label>
          <input
            type="month"
            inputMode="numeric"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
      </div>

      {summary.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4">
          <h2 className="font-semibold mb-2">Validaciones</h2>
          <ul className="list-disc pl-5 space-y-1">
            {summary.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl shadow border">
          <h3 className="font-bold text-lg text-[#0A3558] mb-3">
            Ventas
          </h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Ventas 12%</span>
              <span>{money.format(summary.ventas12)}</span>
            </div>
            <div className="flex justify-between">
              <span>Ventas 0%</span>
              <span>{money.format(summary.ventas0)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>IVA generado</span>
              <span>{money.format(summary.ivaVentas)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow border">
          <h3 className="font-bold text-lg text-[#0A3558] mb-3">
            Compras / Crédito tributario
          </h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Compras 12%</span>
              <span>{money.format(summary.compras12)}</span>
            </div>
            <div className="flex justify-between">
              <span>Compras 0%</span>
              <span>{money.format(summary.compras0)}</span>
            </div>
            <div className="flex justify-between">
              <span>IVA compras</span>
              <span>{money.format(summary.ivaCompras)}</span>
            </div>
            <div className="flex justify-between">
              <span>Retenciones IVA recibidas</span>
              <span>{money.format(summary.retIvaRecibidas)}</span>
            </div>
            <div className="flex justify-between">
              <span>Saldo crédito anterior</span>
              <span>{money.format(summary.saldoCreditoAnterior)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Total crédito</span>
              <span>{money.format(summary.totalCredito)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow border">
        <h3 className="font-bold text-lg text-[#0A3558] mb-4">
          Resultado del período
        </h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">IVA a pagar</div>
            <div className="text-2xl font-bold text-red-600">
              {money.format(summary.ivaPagar)}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">Saldo a arrastrar</div>
            <div className="text-2xl font-bold text-green-600">
              {money.format(summary.saldoArrastrar)}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Generar borrador
          </button>
          <button className="px-4 py-2 border rounded-lg">
            Exportar PDF
          </button>
        </div>
      </div>
    </div>
  );
}