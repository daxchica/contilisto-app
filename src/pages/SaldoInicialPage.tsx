// src/pages/SaldoInicialPage.tsx
// Dedicated page for setting up the opening balance when migrating from another system.

import React, { useEffect, useState } from "react";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { useAuth } from "@/context/AuthContext";
import { getEffectiveAccountPlan } from "@/services/effectiveAccountsService";
import InitialBalancePanel from "@/components/financials/InitialBalancePanel";
import { fetchJournalEntries } from "@/services/journalService";
import type { Account } from "@/types/AccountTypes";

const STEPS = [
  { n: 1, label: "Selecciona la fecha de corte" },
  { n: 2, label: "Ingresa los saldos por cuenta" },
  { n: 3, label: "Verifica y confirma" },
];

export default function SaldoInicialPage() {
  const { selectedEntity } = useSelectedEntity();
  const { user } = useAuth();

  const entityId = selectedEntity?.id ?? "";
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [exists, setExists] = useState<boolean | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [securityWord, setSecurityWord] = useState("");
  const [showEditConfirm, setShowEditConfirm] = useState(false);

  useEffect(() => {
    if (!entityId) return;
    getEffectiveAccountPlan(entityId).then((plan) =>
      setAccounts(plan.effectiveAccounts)
    );
  }, [entityId]);

  useEffect(() => {
    if (!entityId) return;
    fetchJournalEntries(entityId).then((all) => {
      const txId = `INITIAL_BALANCE:${entityId}`;
      setExists(all.some((e) => e.source === "initial" && e.transactionId === txId));
    });
  }, [entityId]);

  if (!selectedEntity) {
    return (
      <div className="p-8 text-center text-gray-500">
        Selecciona una empresa para continuar.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="bg-blue-700 rounded-2xl px-8 py-6 text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-blue-200 text-sm font-medium mb-1 uppercase tracking-wider">
              Migración desde otro sistema
            </p>
            <h1 className="text-2xl font-bold mb-2">Saldo Inicial de Apertura</h1>
            <p className="text-blue-100 max-w-xl text-sm leading-relaxed">
              Registra los saldos finales de tu sistema anterior como punto de partida.
              Contilisto usará estos valores como base para todos los reportes futuros.
            </p>
          </div>
          <div className="bg-blue-600 rounded-xl px-5 py-4 text-sm min-w-[180px]">
            <p className="text-blue-200 mb-1">Empresa</p>
            <p className="font-bold text-base truncate">{selectedEntity.name}</p>
            <p className="text-blue-300 text-xs">{selectedEntity.ruc}</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-0 mt-6">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white/20 border-2 border-white/60 flex items-center justify-center text-xs font-bold">
                  {s.n}
                </div>
                <span className="text-sm text-blue-100 hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px bg-white/20 mx-3" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Instructions ───────────────────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          {
            icon: "📅",
            title: "1. Fecha de corte",
            body: "Elige el último día del mes en que cerraste tu sistema anterior (ej. 31 de diciembre de 2024). Todos los saldos deben corresponder a esa fecha.",
          },
          {
            icon: "📋",
            title: "2. Saldos por cuenta",
            body: "Ingresa el saldo de cada cuenta del plan de cuentas: activos al débito, pasivos y patrimonio al crédito. El total debe cuadrar.",
          },
          {
            icon: "✅",
            title: "3. Verifica y confirma",
            body: "Revisa el balance de comprobación generado. Solo podrás confirmar si débitos y créditos son iguales. Podrás editar después si necesitas correcciones.",
          },
        ].map(({ icon, title, body }) => (
          <div key={title} className="bg-white rounded-xl border p-5 shadow-sm">
            <div className="text-2xl mb-2">{icon}</div>
            <h3 className="font-semibold text-gray-800 mb-1">{title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      {/* ── Status banner if already exists ────────────────────────── */}
      {exists && !editMode && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold text-green-800">Balance inicial ya registrado</p>
              <p className="text-sm text-green-700">
                Esta empresa ya tiene un saldo de apertura configurado. Puedes editarlo si necesitas hacer correcciones.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowEditConfirm(true)}
            className="shrink-0 px-4 py-2 border border-green-600 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition"
          >
            ✏️ Editar saldo inicial
          </button>
        </div>
      )}

      {/* ── Edit confirmation (security gate) ──────────────────────── */}
      {showEditConfirm && !editMode && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-6 py-5 space-y-3">
          <p className="font-semibold text-amber-800">
            ⚠️ Confirmar edición del saldo inicial
          </p>
          <p className="text-sm text-amber-700">
            Modificar el saldo inicial afectará todos los reportes contables.
            Escribe <strong>EDITAR</strong> para confirmar.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={securityWord}
              onChange={(e) => setSecurityWord(e.target.value)}
              placeholder="Escribe EDITAR"
              className="border rounded px-3 py-2 text-sm w-44"
            />
            <button
              onClick={() => {
                if (securityWord.trim().toUpperCase() === "EDITAR") {
                  setEditMode(true);
                  setShowEditConfirm(false);
                  setSecurityWord("");
                } else {
                  alert("Palabra incorrecta.");
                }
              }}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition"
            >
              Desbloquear
            </button>
            <button
              onClick={() => {
                setShowEditConfirm(false);
                setSecurityWord("");
              }}
              className="text-sm text-gray-500 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Main panel ─────────────────────────────────────────────── */}
      {user && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              {editMode ? "✏️ Editar balance inicial" : "📊 Ingreso de saldos"}
            </h2>
            {editMode && (
              <button
                onClick={() => setEditMode(false)}
                className="text-sm text-gray-500 hover:underline"
              >
                ✕ Cancelar edición
              </button>
            )}
          </div>
          <div className="p-6">
            <InitialBalancePanel
              entityId={entityId}
              userIdSafe={user.uid}
              accounts={accounts}
              editMode={editMode}
              alwaysOpen
            />
          </div>
        </div>
      )}

      {/* ── Help footer ────────────────────────────────────────────── */}
      <div className="bg-gray-50 rounded-xl border px-6 py-4 text-sm text-gray-600">
        <p className="font-medium text-gray-700 mb-1">💡 Consejos para la migración</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Usa el balance de comprobación final de tu sistema anterior como referencia.</li>
          <li>Las cuentas de activo (grupo 1) van al <strong>débito</strong>; pasivo y patrimonio (grupos 2 y 3) van al <strong>crédito</strong>.</li>
          <li>El balance debe cuadrar: Total Débito = Total Crédito.</li>
          <li>Si tienes utilidades acumuladas, inclúyelas en la cuenta de patrimonio correspondiente (ej. 301050101).</li>
        </ul>
      </div>

    </div>
  );
}
