// ============================================================================
// src/pages/Landing.tsx
// Landing Page profesional para Contilisto.com
// ============================================================================
import { Link } from "react-router-dom";
import { useCallback, useState, useRef, useEffect } from "react";
import { auth } from "@/firebase-config";
import { PlanType } from "@/config/plans";
import { useNavigate } from "react-router-dom";
import PricingPlans from "../components/PricingPlans";
import Footer from "../components/footer/Footer";
import FeatureCards from "../components/FeatureCards";
import LoginModal from "@/components/modals/LoginModal";
import CheckoutModal from "@/components/modals/CheckoutModal";
import RegisterModal from "@/components/RegisterModal";

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<PlanType | null>(null);
  const [processing, setProcessing] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const openLogin = useCallback(() => {
    setMobileOpen(false);
    setLoginOpen(true);
  }, []);

  const closeLogin = useCallback(() => {
    setLoginOpen(false);
  }, []);

  const scrollToPricing = useCallback(() => {
  setMobileOpen(false);

  const el = document.getElementById("pricing-cards");

  if (el) {
    const rect = el.getBoundingClientRect();

    const y = 
      rect.top + 
      window.scrollY - 
      window.innerHeight / 2 +
      rect.height / 2;

    window.scrollTo({
      top: y,
      behavior: "smooth",
    });
  }
}, []);

  

  const handleRequireAuth = (plan: PlanType) => {
    console.log("🔐 Opening register for:", plan);

    setPendingPlan(plan);
    setShowRegister(true);
  };

  const navigate = useNavigate();

  const handleRegisterSuccess = async () => {
    console.log("✅ Register success");

    const plan = pendingPlan;

    setPendingPlan(null);
    setShowRegister(false);

    setTimeout(() => {

      if (plan === "estudiante") {
        console.log("Activating free plan");
        navigate("/dashboard");
        return;
      }

      if (plan) {
        console.log("Opening checkout for:", pendingPlan);

        setSelectedPlan(plan); // 🔥 continues flow → opens CheckoutModal
        
      }
    }, 0);
  }

  const handleSelectPlan = async (plan: PlanType) => {
    if (processing) return;
    setProcessing(true);

    try {
      console.log("📦 Plan selected:", plan);

      // ✅ User already logged in
      if (plan === "estudiante") {
        console.log("🎉 Activating free plan");

        navigate("/dashboard");
        return;
      }

      setSelectedPlan(plan);
    } finally {
      setProcessing(false);
    }
  };

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
              <a href="#faq" onClick={() => setMobileOpen(false)} className="text-gray-700 hover:text-blue-700">
                FAQ
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
                <a href="#como-funciona" onClick={() => setMobileOpen(false)}>
                  Cómo funciona
                </a>
                <a href="#beneficios" onClick={() => setMobileOpen(false)}>
                  Beneficios
                </a>
                <a href="#precios" onClick={() => setMobileOpen(false)}>
                  Precios
                </a>
                <a href="#faq" onClick={() => setMobileOpen(false)}>
                  FAQ
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

              {/* MOCKUP — browser frame */}
              <div className="rounded-2xl shadow-2xl overflow-hidden border border-gray-200 transform lg:scale-105">

                {/* Browser chrome */}
                <div className="bg-gray-100 border-b px-4 py-2.5 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-400 border">
                    contilisto.com/dashboard
                  </div>
                </div>

                {/* App shell */}
                <div className="flex h-64">

                  {/* Sidebar */}
                  <div className="w-32 bg-blue-900 text-white p-3 flex flex-col gap-1 text-xs shrink-0">
                    <p className="font-bold text-sm mb-3 px-2">Contilisto</p>
                    {[
                      { label: "Tablero",      active: true  },
                      { label: "Facturación",  active: false },
                      { label: "Contabilidad", active: false },
                      { label: "Bancos",       active: false },
                      { label: "SRI",          active: false },
                    ].map(({ label, active }) => (
                      <div
                        key={label}
                        className={`px-2 py-1.5 rounded-lg ${active ? "bg-blue-700 font-semibold" : "text-blue-200"}`}
                      >
                        {label}
                      </div>
                    ))}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 bg-gray-50 p-3 overflow-hidden flex flex-col gap-3">

                    {/* KPI cards */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white rounded-xl p-2.5 shadow-sm border">
                        <p className="text-xs text-gray-500">Ingresos</p>
                        <p className="text-sm font-bold text-green-600">$12.450</p>
                        <p className="text-xs text-green-500">↑ 8%</p>
                      </div>
                      <div className="bg-white rounded-xl p-2.5 shadow-sm border">
                        <p className="text-xs text-gray-500">Gastos</p>
                        <p className="text-sm font-bold text-red-500">$8.230</p>
                        <p className="text-xs text-red-400">↑ 3%</p>
                      </div>
                      <div className="bg-white rounded-xl p-2.5 shadow-sm border">
                        <p className="text-xs text-gray-500">Utilidad</p>
                        <p className="text-sm font-bold text-blue-700">$4.220</p>
                        <p className="text-xs text-blue-400">↑ 15%</p>
                      </div>
                    </div>

                    {/* Mini bar chart */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border flex-1">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Ingresos vs Gastos</p>
                      <div className="flex items-end gap-1.5 h-16">
                        {[
                          { inc: 60, exp: 40 },
                          { inc: 75, exp: 55 },
                          { inc: 50, exp: 45 },
                          { inc: 85, exp: 60 },
                          { inc: 70, exp: 50 },
                          { inc: 90, exp: 65 },
                        ].map((d, i) => (
                          <div key={i} className="flex-1 flex items-end gap-0.5">
                            <div className="flex-1 bg-emerald-400 rounded-t" style={{ height: `${d.inc}%` }} />
                            <div className="flex-1 bg-rose-300 rounded-t"    style={{ height: `${d.exp}%` }} />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Ingresos
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-rose-300 inline-block" />Gastos
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Status bar */}
                <div className="bg-blue-700 px-4 py-2 flex items-center justify-between text-xs text-white/80">
                  <span>✓ Asiento generado automáticamente · IVA 15%</span>
                  <span className="animate-pulse text-white font-semibold">● IA activa</span>
                </div>

              </div>
            </div>
          </div>
        </section>
        
        {/* TRUST SIGNALS */}
        <div className="border-y border-gray-100 bg-gray-50">
          <div className="max-w-5xl mx-auto px-6 py-6">
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-green-500 font-bold text-base">✓</span>
                <span>100% compatible con SRI Ecuador</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500 font-bold text-base">✓</span>
                <span>Datos encriptados y seguros</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500 font-bold text-base">✓</span>
                <span>Sin permanencia — cancela cuando quieras</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500 font-bold text-base">✓</span>
                <span>Soporte en español</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500 font-bold text-base">✓</span>
                <span>Plan gratuito disponible</span>
              </div>
            </div>
          </div>
        </div>

        {/* HOW IT WORKS */}
        <section id="como-funciona" className="py-12 md:py-20">

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
        <section id="beneficios" className="bg-gray-50 py-12 md:py-20">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-10">
              Funciones diseñadas para contadores
            </h2>

            <p className="text-gray-600 text-center max-w-2xl mx-auto mb-16">
              Todo lo que necesitas para automatizar tu contabilidad,
              desde generación de asientos hasta conciliación bancaria.
            </p>

            <FeatureCards />
          </div>
        </section>

        {/* PRECIOS */}
        <section id="precios" className="py-20">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-6">
              Planes diseñados para contadores
            </h2>

            <p className="text-gray-600 text-center mb-6">
              Automatiza tu contabilidad y ahorra horas de trabajo cada semana.
            </p>
            <p className="text-gray-600 text-center mb-16">
              Un contador puede ahorrar más de 10 horas al mes automatizando el registro de facturas.
            </p>
          </div>
          <div id="pricing-cards">
            
            <PricingPlans 
              onSelectPlan={handleSelectPlan}
              onRequireAuth={handleRequireAuth}
            />

            <RegisterModal
              isOpen={showRegister}
              onClose={() => setShowRegister(false)}
              selectedPlan={pendingPlan ?? undefined}
              onRegisterSuccess={handleRegisterSuccess}
            />

                 
          </div>
          {selectedPlan && selectedPlan !== "estudiante" && (
          <CheckoutModal
            planType={selectedPlan}
            onClose={() => setSelectedPlan(null)}
          />
        )}
          
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 bg-gray-50">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Preguntas frecuentes
            </h2>
            <p className="text-gray-600 text-center mb-12">
              ¿Tienes dudas? Aquí están las respuestas más comunes.
            </p>

            <div className="flex flex-col gap-3">
              {[
                {
                  q: "¿Necesito saber contabilidad para usar Contilisto?",
                  a: "No. La inteligencia artificial genera los asientos contables automáticamente. Solo necesitas subir tus facturas en PDF o XML y el sistema hace el resto.",
                },
                {
                  q: "¿Es compatible con el SRI de Ecuador?",
                  a: "Sí, 100%. Puedes emitir facturas electrónicas, firmarlas digitalmente y enviarlas al SRI directamente desde la plataforma. También genera los anexos ATS y declaraciones de IVA.",
                },
                {
                  q: "¿Qué tipos de documentos puedo subir?",
                  a: "Puedes subir facturas en formato PDF o XML (del SRI). La IA extrae automáticamente el proveedor, montos, impuestos y genera el asiento contable correspondiente.",
                },
                {
                  q: "¿Puedo gestionar varias empresas desde una sola cuenta?",
                  a: "Sí. Contilisto soporta multi-empresa. Puedes cambiar de entidad sin cerrar sesión y cada empresa tiene sus propios libros, facturas y reportes.",
                },
                {
                  q: "¿Cómo funciona el plan gratuito?",
                  a: "El Plan Estudiante es completamente gratis, sin tarjeta de crédito. Incluye acceso a las funciones principales para que puedas explorar la plataforma sin compromiso.",
                },
                {
                  q: "¿Puedo cancelar en cualquier momento?",
                  a: "Sí. No hay contratos ni permanencia mínima. Puedes cancelar tu suscripción cuando quieras desde tu perfil.",
                },
                {
                  q: "¿Mis datos están seguros?",
                  a: "Sí. Toda la información se almacena encriptada y la plataforma utiliza infraestructura de nivel empresarial. Nunca compartimos tus datos con terceros.",
                },
              ].map(({ q, a }, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-6 py-4 text-left font-semibold text-gray-900 hover:bg-gray-50 transition"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span>{q}</span>
                    <span className="text-blue-600 text-xl ml-4 shrink-0">
                      {openFaq === i ? "−" : "+"}
                    </span>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-4">
                      {a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
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
                  Activa tu Cuenta
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
      
      <section className="py-28 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-center px-6">
        <h2 className="text-3xl font-bold mb-4">
          Empieza a usar Contilisto hoy
        </h2>

        <p className="mb-6 opacity-90">
          Automatiza tu contabilidad en minutos.
        </p>

        <p className="mb-6 opacity-90">  
          Recibe tips contables y actualizaciones del sistema.
        </p>

        <button
          onClick={scrollToPricing}
          className="bg-white text-blue-600 px-8 py-3 rounded-xl font-semibold hover:bg-blue-50 transition"
        >
          Crear Cuenta Gratis
        </button>
      </section>
      <Footer />
    </div>
  );
}