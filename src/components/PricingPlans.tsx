// src/components/PricingPlans.tsx

import { PlanType } from "@/config/plans";

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

type Props = {
  onSelectPlan: (plan: PlanType) => void;
}

export default function PricingPlans({ onSelectPlan}: Props) {
  return (
    <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 mt-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
  
        {/* =======================
            PLAN ESTUDIANTE
        ======================= */}
        <Wrapper className="bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-900 flex flex-col text-center">
  
          <div className="w-12 h-12 mx-auto rounded-2xl bg-white/70 flex items-center justify-center mb-4">
            <span className="text-2xl">🌱</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold">
            Estudiante
          </h3>

          <div className="flex justify-center items-baseline mt-3">
            <span className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-emerald-700">
              $0
            </span>
            <span className="text-base ml-2">/ mes</span>
          </div>

          <div className="mt-4">
            <span className="inline-block bg-white text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full shadow">
              INCLUYE
            </span>

            <div className="bg-emerald-600/10 rounded-2xl p-4 mt-3 text-sm space-y-2 text-left">
              <p>✅ Hasta 2 empresas</p>
              <p>✅ 100 movimientos contables / mes</p>
              <p>✅ Estado de Resultados y Balance General</p>
              <p>✅ Libro Bancos</p>
              <p>✅ Exportación PDF / CSV</p>
              <p>✅ Soporte por email</p>
            </div>
          </div>

          <p className="mt-3 text-sm text-emerald-800/80">
            Ideal para aprender y probar el flujo.
          </p>

          <button
            onClick={() => onSelectPlan("estudiante")}
            className="mt-6 w-full rounded-xl bg-emerald-600 text-white py-3 font-semibold text-center
                       hover:bg-emerald-700"
          >
            Crear cuenta gratis
          </button>
          Sin tarjeta de crédito.
          Puedes cambiar de plan en cualquier momento.
        </Wrapper>

        {/* =======================
            PLAN CONTADOR (POPULAR)
        ======================= */}
        <Wrapper className="bg-gradient-to-br from-indigo-700 to-indigo-800 text-white flex flex-col text-center ring-4 ring-indigo-400/30 transform scale-105">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-400 text-xs font-semibold px-3 py-1 shadow">
            Más elegido por contadores
          </span>

          <div className="w-12 h-12 mx-auto rounded-2xl bg-white/15 flex items-center justify-center mb-4">
            <span className="text-2xl">✨</span>
          </div>

          <h3 className="transform scale-105 ring-2 ring-blue-500 rounded-2xl shadow-xl">
            Contador
          </h3>
          
          <p>Plan Contador Profesional</p>
          <p>Para contadores independientes</p>

          <div className="flex justify-center items-baseline mt-3">
            <span className="text-4xl sm:text-5xl lg:text-6xl font-extrabold">
              $29
            </span>
            <span className="text-base ml-2">/ mes</span>
          </div>
            Menos de $1 por día

          <div className="mt-4">
            <span className="inline-block bg-white text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full shadow">
              INCLUYE
            </span>

            <div className="bg-indigo-500/30 rounded-2xl p-4 mt-3 text-sm space-y-2 text-left">
              <p>✅ Hasta 10 empresas</p>
              <p>✅ 500 movimientos / mes</p>
              <p>✅ Estados financieros automáticos</p>
              <p>✅ Anexos y declaraciones SRI</p>
              <p>✅ Facturación electrónica</p>
              <p>✅ Hasta 3 usuarios por empresa</p>
            </div>
          </div>

          <button
            onClick={() => onSelectPlan("contador")}
            className="mt-6 w-full rounded-xl border border-white/70 py-3 font-semibold
                       hover:bg-white/10"
          >
            Comenzar con este plan
          </button>
        </Wrapper>

        {/* =======================
            PLAN CORPORATIVO
        ======================= */}
        <Wrapper className="bg-gradient-to-br from-slate-800 to-slate-900 text-white flex flex-col text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-white/10 flex items-center justify-center mb-4">
            <span className="text-2xl">🚀</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold">
            Corporativo
          </h3>
          Para empresas innovadoras.


          <div className="flex justify-center items-baseline mt-3">
            <span className="text-4xl sm:text-5xl lg:text-6xl font-extrabold">
              $69
            </span>
            <span className="text-base ml-2">/ mes</span>
          </div>

          <div className="mt-4">
            <span className="inline-block bg-white text-slate-900 text-xs font-semibold px-3 py-1 rounded-full shadow">
              INCLUYE
            </span>

            <div className="bg-white/10 rounded-2xl p-4 mt-3 text-sm space-y-2 text-left">
              <p>✅ Soporte dedicado</p>
              <p>✅ Facturación electrónica completa</p>
              <p>✅ Declaraciones SRI automáticas</p>
              <p>✅ Dashboard financiero avanzado</p>
              <p>✅ Soporte Tecnológico de última generación.</p>
              <p>✅ Usuarios y límites personalizados</p>
            </div>
          </div>

          <button
            onClick={() => onSelectPlan("corporativo")}
            className="mt-6 w-full rounded-xl bg-white text-slate-900 py-3 font-semibold
                       hover:bg-slate-100"
          >
            Hablar con ventas
          </button>
        </Wrapper>
      </div>
    </section>
  );
}