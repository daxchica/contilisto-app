// ============================================================================
// src/components/PricingPlans.tsx
// CONTILISTO — Pricing Plans (PRODUCTION READY)
// ============================================================================

import { useState } from "react";
import { PlanType } from "@/config/plans";

// ============================================================================
// WRAPPER
// ============================================================================

function Wrapper({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-3xl shadow-xl 
                  p-6 sm:p-8 lg:p-10
                  transition hover:shadow-2xl 
                  focus-within:shadow-2xl ${className}`}
    >
      {children}
    </div>
  );
}

// ============================================================================
// PROPS
// ============================================================================

type Props = {
  onSelectPlan: (plan: PlanType) => Promise<void> | void;
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function PricingPlans({ onSelectPlan }: Props) {
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null);

  async function handleClick(plan: PlanType) {
    try {
      setLoadingPlan(plan);
      await onSelectPlan(plan);
    } catch (err) {
      console.error("Plan selection error:", err);
      alert("Error procesando el plan. Intente nuevamente.");
    } finally {
      setLoadingPlan(null);
    }
  }

  function isLoading(plan: PlanType) {
    return loadingPlan === plan;
  }

  // ==========================================================================
  // UI
  // ==========================================================================

  return (
    <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 mt-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* =======================
            PLAN ESTUDIANTE
        ======================= */}
        <Wrapper className="bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-900 flex flex-col text-center">

          <div className="w-12 h-12 mx-auto rounded-2xl bg-white/70 flex items-center justify-center mb-4">
            🌱
          </div>

          <h3 className="text-xl sm:text-2xl font-bold">Estudiante</h3>

          <div className="flex justify-center items-baseline mt-3">
            <span className="text-5xl font-extrabold text-emerald-700">$0</span>
            <span className="text-base ml-2">/ mes</span>
          </div>

          <div className="mt-4 text-sm space-y-2 text-left bg-emerald-600/10 rounded-2xl p-4">
            <p>✅ Hasta 2 empresas</p>
            <p>✅ 100 movimientos / mes</p>
            <p>✅ Estados financieros</p>
            <p>✅ Libro Bancos</p>
            <p>✅ Exportación PDF / CSV</p>
            <p>✅ Soporte email</p>
          </div>

          <button
            onClick={() => handleClick("estudiante")}
            disabled={!!loadingPlan}
            className="mt-6 w-full rounded-xl bg-emerald-600 text-white py-3 font-semibold
                       hover:bg-emerald-700 disabled:opacity-50"
          >
            {isLoading("estudiante") ? "Procesando..." : "Crear cuenta gratis"}
          </button>

          <p className="text-xs mt-2">
            Sin tarjeta de crédito. Puedes cambiar luego.
          </p>
        </Wrapper>

        {/* =======================
            PLAN CONTADOR
        ======================= */}
        <Wrapper className="bg-gradient-to-br from-indigo-700 to-indigo-800 text-white flex flex-col text-center ring-4 ring-indigo-400/30 scale-105">

          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-400 text-xs px-3 py-1">
            Más elegido
          </span>

          <div className="w-12 h-12 mx-auto rounded-2xl bg-white/15 flex items-center justify-center mb-4">
            ✨
          </div>

          <h3 className="text-2xl font-bold">Contador</h3>

          <div className="flex justify-center items-baseline mt-3">
            <span className="text-5xl font-extrabold">$29</span>
            <span className="ml-2">/ mes</span>
          </div>

          <div className="mt-4 text-sm space-y-2 text-left bg-indigo-500/30 rounded-2xl p-4">
            <p>✅ Hasta 10 empresas</p>
            <p>✅ 500 movimientos / mes</p>
            <p>✅ SRI automático</p>
            <p>✅ Facturación electrónica</p>
            <p>✅ 3 usuarios</p>
          </div>

          <button
            onClick={() => handleClick("contador")}
            disabled={!!loadingPlan}
            className="mt-6 w-full rounded-xl border border-white py-3 font-semibold
                       hover:bg-white/10 disabled:opacity-50"
          >
            {isLoading("contador") ? "Redirigiendo..." : "Comenzar"}
          </button>
        </Wrapper>

        {/* =======================
            PLAN CORPORATIVO
        ======================= */}
        <Wrapper className="bg-gradient-to-br from-slate-800 to-slate-900 text-white flex flex-col text-center">

          <div className="w-12 h-12 mx-auto rounded-2xl bg-white/10 flex items-center justify-center mb-4">
            🚀
          </div>

          <h3 className="text-2xl font-bold">Corporativo</h3>

          <div className="flex justify-center items-baseline mt-3">
            <span className="text-5xl font-extrabold">$69</span>
            <span className="ml-2">/ mes</span>
          </div>

          <div className="mt-4 text-sm space-y-2 text-left bg-white/10 rounded-2xl p-4">
            <p>✅ Soporte dedicado</p>
            <p>✅ SRI automático</p>
            <p>✅ Dashboard avanzado</p>
            <p>✅ Límites personalizados</p>
          </div>

          <button
            onClick={() => handleClick("corporativo")}
            disabled={!!loadingPlan}
            className="mt-6 w-full rounded-xl bg-white text-slate-900 py-3 font-semibold
                       hover:bg-slate-100 disabled:opacity-50"
          >
            {isLoading("corporativo") ? "Redirigiendo..." : "Hablar con ventas"}
          </button>
        </Wrapper>
      </div>
    </section>
  );
}