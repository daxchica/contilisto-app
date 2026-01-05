// ============================================================================
// src/pages/Landing.tsx
// Landing Page profesional para Contilisto.com
// ============================================================================
import { Link } from "react-router-dom";
import { useCallback, useState } from "react";
import PricingPlans from "../components/PricingPlans";
import Footer from "../components/footer/Footer";
import FeatureCards from "../components/FeatureCards";
import LoginModal from "@/components/modals/LoginModal";

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const openLogin = useCallback(() => {
    setMobileOpen(false);
    setLoginOpen(true);
  }, []);

  const closeLogin = useCallback(() => {
    setLoginOpen(false);
  }, []);

  const scrollToPricing = useCallback(() => {
  setMobileOpen(false);
  document
    .getElementById("precios")
    ?.scrollIntoView({ behavior: "smooth" });
}, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* ============================================================
       * NAVBAR
       * ============================================================ */}
      <header className="fixed top-0 left-0 w-full z-30 bg-white/80 backdrop-blur-lg border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="h-16 flex items-center justify-between">
            {/* Logo */}
            <Link
              to="/"
              className="text-2xl md:text-3xl font-extrabold tracking-tight text-blue-900"
            >
              Contilisto
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
              <a href="#como-funciona" className="text-gray-700 hover:text-blue-700">
                Cómo funciona
              </a>
              <a href="#beneficios" className="text-gray-700 hover:text-blue-700">
                Beneficios
              </a>
              <a href="#precios" className="text-gray-700 hover:text-blue-700">
                Precios
              </a>

              <div className="h-6 w-px bg-gray-300" />

              <button
                onClick={openLogin}
                className="text-blue-900 hover:text-blue-700 font-semibold"
              >
                Iniciar sesión
              </button>

              <button
                onClick={scrollToPricing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crear Cuenta
              </button>
            </nav>

            {/* Mobile button */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden text-2xl text-blue-900"
            >
              ☰
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileOpen && (
            <div className="md:hidden pb-4">
              <div className="mt-2 rounded-2xl border bg-white shadow-lg p-5 flex flex-col gap-4 text-base font-semibold">
                <a href="#beneficios" onClick={() => setMobileOpen(false)}>
                  Beneficios
                </a>
                <a href="#precios" onClick={() => setMobileOpen(false)}>
                  Precios
                </a>

                <div className="pt-2 border-t flex flex-col gap-3">
                  <button
                    onClick={openLogin}
                    className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold"
                  >
                    Iniciar sesión
                  </button>

                  <button
                    to="/register"
                    onClick={scrollToPricing}
                    className="text-center text-sm text-blue-700 font-medium"
                  >
                    Crear cuenta
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ============================================================
       * MAIN
       * ============================================================ */}
      <main className="flex-1 pt-20 md:pt-24">
        {/* ============================================================
         * HERO
         * ============================================================ */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-white to-white" />

          <div className="relative max-w-7xl mx-auto px-6 py-12 lg:py-20">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* TEXT */}
              <div className="text-center lg:text-left">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 text-green-700 text-sm font-semibold mb-5">
                  ● Impulsado por Inteligencia Artificial
                </span>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight">
                  Contabilidad más rápida. Más precisa.
                  <span className="block text-blue-700">
                    Totalmente automatizada con IA.
                  </span>
                </h1>

                <p className="mt-6 text-lg text-gray-600 max-w-xl mx-auto lg:mx-0">
                  La plataforma contable más moderna para Ecuador. Sube tus
                  facturas y deja que la IA genere asientos contables con PUC,
                  IVA, conciliaciones bancarias y reportes SRI — en minutos.
                </p>

                {/* ====================================================
                 * CTA DESKTOP
                 * ==================================================== */}
                <div className="hidden md:flex mt-8 gap-4">
                  <button
                    onClick={scrollToPricing}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl text-lg font-semibold hover:bg-blue-700"
                  >
                    Crear Cuenta Gratis
                  </button>

                  <button
                    onClick={openLogin}
                    className="px-8 py-3 bg-white border rounded-xl text-lg font-semibold hover:bg-gray-50"
                  >
                    Ver demostración
                  </button>
                </div>

                {/* ====================================================
                 * CTA MOBILE (LOGIN PRIMARY)
                 * ==================================================== */}
                <div className="md:hidden mt-8 space-y-3">
                  <button
                    onClick={openLogin}
                    className="w-full py-4 bg-blue-600 text-white rounded-xl text-lg font-semibold"
                  >
                    Iniciar sesión
                  </button>

                  <button
                    onClick={scrollToPricing}
                    className="block w-full py-4 text-center border rounded-xl text-lg font-semibold"
                  >
                    Crear Cuenta Gratis
                  </button>

                  <p className="text-sm text-gray-500 text-center">
                    Sin tarjeta de crédito. Prueba gratuita del Plan Estudiante.
                  </p>
                </div>
              </div>

              {/* MOCKUP */}
              <div className="bg-white border rounded-2xl shadow-xl p-6">
                <p className="text-sm font-semibold text-blue-700 mb-2">
                  Vista rápida · Demo IA
                </p>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="font-semibold">PDF Factura</p>
                    <p className="text-xs text-gray-500">
                      Proveedor XYZ<br />Total $120,50
                    </p>
                  </div>

                  <div className="flex items-center justify-center">
                    <span className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                      IA
                    </span>
                  </div>

                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="font-semibold">Asiento contable</p>
                    <p className="text-xs">
                      Bancos / Ventas / IVA
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BENEFICIOS */}
        <section id="beneficios" className="bg-gray-50 py-16">
          <div className="max-w-6xl mx-auto px-6">
            <FeatureCards />
          </div>
        </section>

        {/* PRECIOS */}
        <section id="precios" className="py-16">
          <PricingPlans />
        </section>
      </main>

      {/* LOGIN MODAL */}
      <LoginModal isOpen={loginOpen} onClose={closeLogin} />

      <Footer />
    </div>
  );
}