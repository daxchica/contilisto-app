// src/components/PricingPlans.tsx
import { Link } from "react-router-dom";

function Wrapper({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative rounded-3xl shadow-xl p-8 sm:p-10 transition
                  hover:shadow-2xl focus-within:shadow-2xl ${className}`}
    >
      {children}
    </div>
  );
}

export default function PricingPlans() {
  return (
    <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 mt-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Starter */}
        <Wrapper className="bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-900">
          <div className="w-12 h-12 rounded-2xl bg-white/70 flex items-center justify-center mb-6">
            <span className="text-2xl">🌱</span>
          </div>
          <h3 className="text-2xl font-bold">Plan Básico</h3>
          <p className="mt-1 text-lg font-semibold text-emerald-700">$9.99 / mes</p>
          <p className="mt-2 text-emerald-800/80">Perfecto para iniciar y probar el flujo. 100 registros al mes.</p>
          <Link
            to="/register?plan=starter"
            className="inline-block mt-6 rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold
                       hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700"
          >
            Inicia el Plan Básico
          </Link>
        </Wrapper>

        {/* Professional (Most popular) */}
        <Wrapper className="bg-gradient-to-br from-indigo-700 to-indigo-800 text-white">
          <span
            className="absolute -top-3 left-6 rounded-full bg-indigo-400 text-white text-xs font-semibold
                       px-3 py-1 shadow"
          >
            Más Popular
          </span>
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-6">
            <span className="text-2xl">✨</span>
          </div>
          <h3 className="text-2xl font-bold">Plan Profesional</h3>
          <p className="mt-1 text-lg font-semibold text-indigo-200">$29 / mes</p>
          <p className="mt-2 text-white/80">10 empresas y 500 movimientos. Más capacidad y funciones.</p>
          <Link
            to="/register?plan=pro"
            className="inline-block mt-6 rounded-xl border border-white/60 px-5 py-3 font-semibold
                       hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            Inicia tu plan
          </Link>
        </Wrapper>

        {/* Enterprise */}
        <Wrapper className="bg-gradient-to-br from-slate-800 to-slate-900 text-white">
          <div className="absolute top-0 left-0 w-24 h-20 rounded-tr-3xl rounded-bl-3xl bg-white/10" />
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6 relative">
            <span className="text-2xl">🚀</span>
          </div>
          <h3 className="text-2xl font-bold">Plan Corporativo</h3>
          <p className="mt-1 text-lg font-semibold text-white/90">Precio Personalizado</p>
          <p className="mt-2 text-white/80">Soporte dedicado y necesidades avanzadas.</p>
          <Link
            to="/contact?plan=enterprise"
            className="inline-block mt-6 rounded-xl bg-white text-slate-900 px-5 py-3 font-semibold
                       hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            Contact Sales
          </Link>
        </Wrapper>
      </div>
    </section>
  );
}