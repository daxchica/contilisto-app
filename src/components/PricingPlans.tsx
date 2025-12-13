// src/components/PricingPlans.tsx
import { Link } from "react-router-dom";

function Wrapper({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-3xl shadow-xl p-8 sm:p-10 transition
                  hover:shadow-2xl focus-within:shadow-2xl ${className}`}
    >
      {children}
    </div>
  );
}

function rememberPlan(plan: "starter" | "pro" | "enterprise") {
  sessionStorage.setItem("selectedPlan", plan);
}

export default function PricingPlans() {
  return (
    <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 mt-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Starter */}
        <Wrapper className="bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-900 flex flex-col items-center text-center">
          {/* Icono */}
          <div className="w-12 h-12 rounded-2xl bg-white/70 flex items-center justify-center mb-6">
            <span className="text-2xl">🌱</span>
          </div>

          {/* Título */}
          <h3 className="text-2xl font-bold">Plan Estudiante</h3>

          {/* Precio grande */}
          <div className="flex justify-center items-baseline mt-2">
            <span className="text-6xl font-extrabold leading-none text-emerald-700">
              $0.00
            </span>
            <span className="text-lg ml-2 opacity-90">/ mes</span>
          </div>

          {/* Tarjeta interna con “Incluye” + lista */}
          <div className="w-full mt-5">
            <div className="flex justify-center">
              <span className="bg-white text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full shadow">
                INCLUYE
              </span>
            </div>

            <div className="bg-emerald-600/10 rounded-2xl p-5 mt-3 text-left max-w-sm mx-auto space-y-2">
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Hasta 2 empresas</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>100 movimientos contables al mes</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Estados financieros (ER y Balance)</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Libro Bancos y conciliación</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Exportación a PDF y CSV</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Soporte por email</p>
              </div>
            </div>
          </div>

          <p className="mt-2 text-emerald-800/80">
            Perfecto para iniciar y probar el flujo.
          </p>

          {/* CTA */}
          <Link
            to="/register?plan=starter"
            onClick={() => rememberPlan("starter")}
            className="inline-block mt-6 rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold
                       hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700"
          >
            Inicia Plan
          </Link>
        </Wrapper>

        {/* Professional (Most popular) */}
        <Wrapper className="bg-gradient-to-br from-indigo-700 to-indigo-800 text-white flex flex-col items-center text-center ring-4 ring-indigo-400/30 hover:scale-[1.01]">
          {/* Badge */}
          <span
            className="absolute -top-3 left-6 rounded-full bg-indigo-400 text-white text-xs font-semibold px-3 py-1 shadow"
          >
            Más Popular
          </span>

          {/* Icono */}
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-6">
            <span className="text-2xl">✨</span>
          </div>

          {/* Título */}
          <h3 className="text-2xl font-bold">Plan Contador</h3>

          {/* Precio grande */}
          <div className="flex justify-center items-baseline mt-2">
            <span className="text-6xl font-extrabold leading-none">$29.00</span>
            <span className="text-lg ml-2 opacity-90">/ mes</span>
          </div>

          {/* Tarjeta interna con “Incluye” + lista */}
          <div className="w-full mt-5">
            <div className="flex justify-center">
              <span className="bg-white text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full shadow">
                INCLUYE
              </span>
            </div>

            <div className="bg-indigo-500/30 rounded-2xl p-5 mt-3 text-left max-w-sm mx-auto space-y-2">
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Hasta 10 empresas</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>500 movimientos contables al mes</p>
              </div>
              
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Emisión de Anexos y Declaraciones SRI</p>
              </div>
              
              
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Estados financieros (ER y Balance)</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Libro Bancos y conciliación</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Hasta 3 usuarios autorizados</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Facturación Electrónica</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <Link
            to="/register?plan=pro"
            onClick={() => rememberPlan("pro")}
            className="inline-block mt-6 rounded-xl border border-white/70 px-6 py-3 font-semibold
                       hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            Inicia plan
          </Link>
        </Wrapper>

        {/* Enterprise */}
        <Wrapper className="bg-gradient-to-br from-slate-800 to-slate-900 text-white flex flex-col items-center text-center">
          <div className="absolute top-0 left-0 w-24 h-20 rounded-tr-3xl rounded-bl-3xl bg-white/10" />
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6 relative">
            <span className="text-2xl">🚀</span>
          </div>

          <h3 className="text-2xl font-bold">Plan Corporativo</h3>
          <div className="flex justify-center items-baseline mt-2">
          <p className="text-6xl font-extrabold leading-none">$69.00</p>
          <span className="text-lg ml-2 opacity-90">/ mes</span>
          </div>

          <div className="w-full mt-5">
            <div className="flex justify-center">
              <span className="bg-white text-slate-900 text-xs font-semibold px-3 py-1 rounded-full shadow">
                INCLUYE
              </span>
            </div>

            <div className="bg-white/10 rounded-2xl p-5 mt-3 text-left max-w-sm mx-auto space-y-2">
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Soporte dedicado con IA</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Facturación Electrónica</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Emisión de declaraciones SRI</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Dashboard Profesional</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Hasta 5 usuarios autorizacos</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Soporte dedicado con IA</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Integraciones y necesidades avanzadas</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5">✅</span>
                <p>Volúmenes y límites personalizados</p>
              </div>
            </div>
          </div>

          <Link
            to="/contact?plan=enterprise"
            onClick={() => rememberPlan("enterprise")}
            className="inline-block mt-6 rounded-xl bg-white text-slate-900 px-5 py-3 font-semibold
                       hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            Inicia plan
          </Link>
        </Wrapper>
      </div>
    </section>
  );
}