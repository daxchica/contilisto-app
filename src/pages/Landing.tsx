// ============================================================================
// src/pages/Landing.tsx
// Landing Page profesional para Contilisto.com
// ============================================================================
import { Link } from "react-router-dom";
import { useCallback, useState, useRef, useEffect } from "react";
import PricingPlans from "../components/PricingPlans";
import Footer from "../components/footer/Footer";
import FeatureCards from "../components/FeatureCards";
import LoginModal from "@/components/modals/LoginModal";

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showCTA, setShowCTA] = useState(false);

  const openLogin = useCallback(() => {
    setMobileOpen(false);
    setLoginOpen(true);
  }, []);

  const closeLogin = useCallback(() => {
    setLoginOpen(false);
  }, []);

  const scrollToPricing = useCallback(() => {
  setMobileOpen(false);

  const el = document.getElementById("precios");

  if (el) {
    const y = el.getBoundingClientRect().top + window.scrollY - 80;

    window.scrollTo({
      top: y,
      behavior: "smooth",
    });
  }
}, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const closeDemo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setShowDemo(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDemo();
    };

    if (showDemo) {
      window.addEventListener("keydown", onKey);
    }

    return () => window.removeEventListener("keydown", onKey);
  }, [showDemo, closeDemo]);

  useEffect(() => {
  document.body.style.overflow = mobileOpen ? "hidden" : "";
  }, [mobileOpen]);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.currentTime / video.duration > 0.8) {
        setShowCTA(true);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [showDemo]);

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* ============================================================
       * NAVBAR
       * ============================================================ */}
      <header 
        className={`fixed top-0 left-0 w-full z-30 backdrop-blur-lg border-b transition ${
          scrolled ? "bg-white shadow-sm" : "bg-white/80"
        }`}
      >

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
              <a href="#como-funciona" onClick={() => setMobileOpen(false)} className="text-gray-700 hover:text-blue-700">
                Cómo funciona
              </a>
              <a href="#beneficios" onClick={() => setMobileOpen(false)} className="text-gray-700 hover:text-blue-700">
                Beneficios
              </a>
              <a href="#precios" onClick={() => setMobileOpen(false)} className="text-gray-700 hover:text-blue-700">
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
                Crear Cuenta Gratis
              </button>
            </nav>

            {/* Mobile button */}
            <button
              aria-label="Abrir menú"
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

          <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-24">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* TEXT */}
              <div className="text-center lg:text-left">
                
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 text-green-700 text-sm font-semibold mb-5">
                  ● Impulsado por Inteligencia Artificial
                </span>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight">
                  Contabilidad más rápida. 
                  Más precisa.
                  <span className="block text-blue-700">
                    Automatizada con Inteligencia Artificial.
                  </span>
                </h1>

                <p className="mt-6 text-lg text-gray-600 max-w-xl mx-auto lg:mx-0">
                  La plataforma contable más moderna para Ecuador. Sube tus
                  facturas y deja que la IA genere asientos contables con PUC,
                  IVA, conciliaciones bancarias y reportes SRI — en minutos.
                </p>

                <div className="flex flex-wrap gap-10 mt-10 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-700">10x</span> más rápido
                  </div>
                  <div>
                    <span className="font-bold text-blue-700">90%</span> menos trabajo manual
                  </div>
                  <div>
                    <span className="font-bold text-blue-700">100%</span> compatible con SRI
                  </div>
                </div>

                <p className="mt-4 text-sm text-gray-500">
                  Diseñado para contadores en Ecuador · Compatible con SRI · Plan Único de Cuentas
                </p>

                {/* ====================================================
                 * CTA DESKTOP
                 * ==================================================== */}
                <div className="hidden md:flex mt-8 gap-4">
                  <button
                    onClick={scrollToPricing}
                    className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
                  >
                    Crear Cuenta Gratis
                  </button>

                  <button
                    onClick={() => setShowDemo(true)}
                    className="px-8 py-3 bg-white border border-gray-300 rounded-xl text-lg font-semibold hover:bg-gray-50"
                  >
                    Ver demostración
                  </button>
                </div>

                <p className="text-sm text-gray-500 mt-4">
                  Sin tarjeta de crédito. Prueba gratuita disponible.
                </p>

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
              <div className="bg-white border rounded-2xl shadow-2xl overflow-hidden transform lg:scale-105">
                

                <p className="px-4 py-3 text-sm font-semibold text-blue-700 mb-3">
                  Automatización contable en segundos.
                </p>
                

                <div className="grid grid-cols-3 gap-4 text-sm items-center">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="font-semibold">PDF Factura</p>
                    <p className="text-xs text-gray-500">
                      Proveedor XYZ<br />Total $120,50
                    </p>
                  </div>
                  

                  <div className="flex items-center justify-center">
                    <span className="h-14 w-14 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold animate-[pulse_2.5s_infinite]">
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
        
        <div className="border-t border-gray-100" />
        
        {/* HOW IT WORKS */}
        <section id="como-funciona" className="py-20">

          <div className="max-w-6xl mx-auto px-6 text-center">

            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Cómo funciona Contilisto
            </h2>

            <p className="text-gray-600 max-w-2xl mx-auto mb-14">
              Automatiza el proceso contable en segundos.
              Solo sube tu factura y la inteligencia artificial hace el resto.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-6 items-center">

              {/* Step 1 */}
              <div className="p-6 rounded-xl border bg-white shadow-sm hover:shadow-md transition text-center">
                <div className="text-blue-600 text-3xl font-bold mb-3">1</div>
                <h3 className="font-semibold text-lg mb-2">
                  📄 Subes la factura 
                </h3>
                <p className="text-gray-600 text-sm">
                  Arrastra tu factura PDF o XML al sistema.
                </p>
              </div>
              {/* Arrow */}
              <div className="hidden md:flex items-center justify-center text-gray-300 text-3xl">
                →
              </div>
              {/* Step 2 */}
              <div className="p-6 rounded-xl border bg-white shadow-sm hover:shadow-md transition text-center">
                <div className="text-blue-600 text-3xl font-bold mb-3">2</div>
                <h3 className="font-semibold text-lg mb-2">
                  🤖 La IA analiza 
                </h3>
                <p className="text-gray-600 text-sm">
                  Contilisto identifica proveedor, impuestos y cuentas contables.
                </p>
              </div>
              {/* Arrow */}
              <div className="hidden md:flex items-center justify-center text-gray-300 text-3xl">
                →
              </div>
              {/* Step 3 */}
              <div className="p-6 rounded-xl border bg-white shadow-sm hover:shadow-md transition text-center">
                <div className="text-blue-600 text-3xl font-bold mb-3">3</div>
                <h3 className="font-semibold text-lg mb-2">
                  📊 Asiento generado
                </h3>
                <p className="text-gray-600 text-sm">
                  El asiento contable se crea automáticamente según el PUC.
                </p>
              </div>

            </div>
          </div>
        </section>

        <div className="border-t border-gray-100" />

        {/* BENEFICIOS */}
        <section id="beneficios" className="bg-gray-50 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-10">
          Funciones diseñadas para contadores
          </h2>

          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-16">
          Todo lo que necesitas para automatizar tu contabilidad,
          desde generación de asientos hasta conciliación bancaria.
          </p>
          <div className="max-w-6xl mx-auto px-6">
            <FeatureCards />
          </div>
        </section>

        {/* PRECIOS */}
        <section id="precios" className="py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-6">
            Planes diseñados para contadores
          </h2>

          <p className="text-gray-600 text-center mb-6">
            Automatiza tu contabilidad y ahorra horas de trabajo cada semana.
          </p>
          <p className="text-gray-600 text-center mb-16">
          Un contador puede ahorrar mas de 10 horas al mes automatizando el registro de facturas.</p>
          <PricingPlans />

        </section>
      </main>

      {showDemo && (
        
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer"
          onClick={closeDemo}
        >

          
          <div
            className="w-[90vw] h-[80vh] max-w-6xl bg-black rounded-xl overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >

            
            <video
              ref={videoRef}
              controls
              autoPlay
              className="w-full h-full object-contain"
            >
              
              <source src="/videos/contilisto_vs_others.mp4" type="video/mp4" />
            </video>

            <button
              onClick={closeDemo}
              className="
                absolute top-4 right-4 z-50 
                bg-black/60 backdrop-blur-md
                hover:bg-black/80 
                text-white text-lg 
                w-9 h-9 
                rounded-full 
                flex items-center justify-center 
                transition"
            >
              X
            </button>

            {/* ✅ CTA OVERLAY (THIS IS THE KEY PART) */}
            {showCTA && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 text-center animate-[fadeIn_0.5s_ease]">
                
                <p className="text-white text-lg mb-3 font-semibold">
                  Empieza a ahorrar horas de trabajo hoy
                </p>

                <button
                  onClick={() => {
                    closeDemo();
                    scrollToPricing();
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl text-lg font-semibold shadow-lg"
                >
                  Crear Cuenta Gratis
                </button>

                <p className="text-sm text-gray-300 mt-2">
                  Empieza en menos de 1 minuto
                </p>
              </div>
            )}
          </div>
        </div>
        
      )}

      {/* LOGIN MODAL */}
      <LoginModal isOpen={loginOpen} onClose={closeLogin} />
      
      <section className="py-28 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-center">
        <h2 className="text-3xl font-bold mb-4">
          Empieza a usar Contilisto hoy
        </h2>

        <p className="mb-6 opacity-90">
          Automatiza tu contabilidad en minutos.
        </p>

        <p className="mb-6 opacity-90">  
          Recibe tips contables y actualizaciones del sistema.
        </p>

        <button className="bg-white text-blue-600 px-8 py-3 rounded-xl font-semibold">
          Crear Cuenta Gratis
        </button>
      </section>
      <Footer />
    </div>
  );
}