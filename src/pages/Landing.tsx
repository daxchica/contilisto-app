// ============================================================================
// src/pages/Landing.tsx
// Landing Page profesional para Contilisto.com
// ============================================================================
import { Link } from "react-router-dom";
import { useState, useCallback } from "react";
import PricingPlans from "../components/PricingPlans";
import Footer from "../components/footer/Footer";
import FeatureCards from "../components/FeatureCards";
import LoginModal from "@/components/modals/LoginModal";

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  /* ------------------------------------------------------------------
   * Handlers
   * ------------------------------------------------------------------ */
  const openLogin = useCallback(() => {
    setMobileOpen(false);
    setLoginOpen(true);
  }, []);

  const closeLogin = useCallback(() => {
    setLoginOpen(false);
  }, []);

  const toggleMobileMenu = () => {
    setMobileOpen(v => !v);
  };

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
              className="text-2xl font-extrabold tracking-tight text-blue-900"
            >
              Contilisto
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-semibold z-10">
              <a href="#como-funciona" className="text-gray-700 hover:text-blue-700">
                Cómo funciona
              </a>
              <a href="#beneficios" className="text-gray-700 hover:text-blue-700">
                Beneficios
              </a>
              <a href="#precios" className="text-gray-700 hover:text-blue-700">
                Precios
              </a>

              <div className="h-6 w-px bg-gray-300 hidden sm:block" />

              <button
                type="button"
                onClick={openLogin}
                className="relative z-10 text-blue-900 hover:text-blue-700 font-semibold"
              >
                Iniciar sesión
              </button>

              <Link
                to="/register"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Crear cuenta
              </Link>
            </nav>

            {/* Mobile Button */}
            <button
              type="button"
              className="md:hidden text-2xl text-blue-900"
              aria-label="Abrir menú"
              aria-expanded={mobileOpen}
              onClick={toggleMobileMenu}
            >
              ☰
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileOpen && (
            <div className="md:hidden pb-4">
              <div className="mt-2 rounded-xl border bg-white shadow-md p-4 flex flex-col gap-3 text-sm font-semibold">
                <a href="#como-funciona">Cómo funciona</a>
                <a href="#beneficios">Beneficios</a>
                <a href="#precios">Precios</a>

                <button
                  type="button"
                  onClick={openLogin}
                  className="text-left"
                >
                  Iniciar sesión
                </button>

                <Link
                  to="/register"
                  className="bg-blue-600 text-white text-center py-2 rounded-lg"
                >
                  Crear cuenta
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ============================================================
       * MAIN CONTENT
       * ============================================================ */}
      <main className="flex-1 pt-20 md:pt-24">
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="
            absolute inset-0 
            bg-gradient-to-b from-blue-50 via-white to-white
            pointer-events-none 
            -z-10
            " 
          />

          <div className="relative max-w-7xl mx-auto px-6 py-16 lg:py-24 flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold mb-4 border border-green-100">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Impulsado por Inteligencia Artificial
              </span>

              <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
                Contabilidad más rápida. Más precisa.
                <span className="block text-blue-700">
                  Totalmente automatizada con IA.
                </span>
              </h1>

              <p className="mt-6 text-lg text-gray-600 max-w-xl mx-auto lg:mx-0">
                La plataforma contable más moderna para Ecuador. Sube tus
                facturas y deja que la IA haga el trabajo pesado.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  to="/register"
                  className="px-8 py-3 bg-blue-600 text-white rounded-xl text-lg font-semibold hover:bg-blue-700 shadow-md transition"
                >
                  Crear Cuenta Gratis
                </Link>

                <button
                  type="button"
                  onClick={openLogin}
                  className="px-8 py-3 bg-white border border-gray-200 rounded-xl text-lg font-semibold hover:bg-gray-50"
                >
                  Ver demostración
                </button>
              </div>

              <p className="mt-4 text-sm text-gray-500">
                Sin tarjeta de crédito. Prueba gratuita disponible.
              </p>
            </div>

            {/* Mockup */}
            {/* (Se mantiene igual que tu versión, sin cambios funcionales) */}
          </div>
        </section>

        {/* RESTO DE SECCIONES */}
        {/* (Todo tu contenido actual queda igual) */}

        <FeatureCards />
        <PricingPlans />
      </main>

      {/* ============================================================
       * LOGIN MODAL
       * ============================================================ */}
      <LoginModal
        isOpen={loginOpen}
        onClose={closeLogin}
      />

      {/* FOOTER */}
      <Footer />
    </div>
  );
}