// ============================================================================
// src/pages/Landing.tsx
// Landing Page profesional para Contilisto.com
// ============================================================================
import { Link } from "react-router-dom";
import { useCallback, useState, useEffect } from "react";
import { auth } from "@/firebase-config";
import { PlanType } from "@/config/plans";
import { useNavigate } from "react-router-dom";
import PricingPlans from "../components/PricingPlans";
import Footer from "../components/footer/Footer";
import FeatureCards from "../components/FeatureCards";
import LoginModal from "@/components/modals/LoginModal";
import CheckoutModal from "@/components/modals/CheckoutModal";
import RegisterModal from "@/components/RegisterModal";
import { PlayCircleIcon } from "@heroicons/react/24/solid";

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }, []);

  const scrollToEstudianteCard = useCallback(() => {
    setMobileOpen(false);
    const el = document.getElementById("estudiante-card");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const handleRequireAuth = (plan: PlanType) => {
    if (plan === "estudiante") {
      navigate("/trial");
      return;
    }
    setPendingPlan(plan);
    setShowRegister(true);
  };

  const navigate = useNavigate();

  const handleRegisterSuccess = async () => {
    const plan = pendingPlan;
    setPendingPlan(null);
    setShowRegister(false);
    setTimeout(() => {
      navigate("/verify-email");
      if (plan && plan !== "estudiante") {
        setSelectedPlan(plan);
      }
    }, 0);
  };

  const handleSelectPlan = async (plan: PlanType) => {
    if (processing) return;
    setProcessing(true);
    try {
      if (plan === "estudiante") {
        navigate("/trial");
        return;
      }
      setSelectedPlan(plan);
    } finally {
      setProcessing(false);
    }
  };

  const closeDemo = useCallback(() => {
    setShowDemo(false);
  }, []);

  const openDemo = useCallback(() => {
    setShowDemo(true);
  }, []);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDemo();
    };
    if (showDemo) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDemo, closeDemo]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
  }, [mobileOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);


  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* ================================================================
       * NAVBAR
       * ============================================================== */}
      <header
        className={`fixed top-0 left-0 w-full z-30 backdrop-blur-lg border-b transition ${
          scrolled ? "bg-white shadow-sm" : "bg-white/80"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="h-16 flex items-center justify-between">
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
              <button onClick={openLogin} className="text-blue-900 hover:text-blue-700 font-semibold">
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
                <a href="#como-funciona" onClick={() => setMobileOpen(false)}>Cómo funciona</a>
                <a href="#beneficios" onClick={() => setMobileOpen(false)}>Beneficios</a>
                <a href="#precios" onClick={() => setMobileOpen(false)}>Precios</a>
                <a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a>
                <div className="pt-2 border-t flex flex-col gap-3">
                  <button
                    onClick={openDemo}
                    className="w-full py-3 rounded-xl bg-gray-900 text-white font-semibold flex items-center justify-center gap-2"
                  >
                    <PlayCircleIcon className="w-5 h-5" />
                    Ver Demo
                  </button>
                  <button
                    onClick={openLogin}
                    className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold"
                  >
                    Iniciar sesión
                  </button>
                  <button
                    onClick={scrollToEstudianteCard}
                    className="text-center text-sm text-green-600 font-medium"
                  >
                    Crear cuenta gratis
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ================================================================
       * MAIN
       * ============================================================== */}
      <main className="flex-1 pt-16">

        {/* ================================================================
         * HERO
         * ============================================================== */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-white" />

          <div className="relative max-w-7xl mx-auto px-6 py-8 sm:py-14 lg:py-20">
            <div className="grid lg:grid-cols-2 gap-10 xl:gap-16 items-start">

              {/* TEXT */}
              <div className="text-center lg:text-left">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-50 text-green-700 text-sm font-semibold mb-5">
                  ● Impulsado por Inteligencia Artificial
                </span>

                <h1 className="text-3xl sm:text-5xl xl:text-6xl font-extrabold leading-tight">
                  Contabilidad más rápida.{" "}
                  Más precisa.
                  <span className="block text-blue-700 mt-1">
                    Automatizada con IA.
                  </span>
                </h1>

                <p className="mt-5 text-base sm:text-lg text-gray-600 max-w-xl mx-auto lg:mx-0">
                  La plataforma contable más moderna para Ecuador. Sube tus
                  facturas y deja que la IA genere asientos contables, IVA,
                  conciliaciones bancarias y reportes SRI — en minutos.
                </p>

                {/* CTA — Desktop */}
                <div className="hidden md:flex mt-7 gap-3 items-center">
                  <button
                    onClick={scrollToPricing}
                    className="bg-blue-600 text-white px-7 py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
                  >
                    Crear Cuenta Gratis
                  </button>
                  <button
                    onClick={openDemo}
                    className="group flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition"
                  >
                    <PlayCircleIcon className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                    Ver Demo
                  </button>
                </div>

                {/* Social proof */}
                <div className="hidden md:flex items-center gap-3 mt-5">
                  {/* Avatar stack */}
                  <div className="flex -space-x-2">
                    {["EF","MC","RV","AP","JL"].map((initials, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ zIndex: 5 - i }}
                      >
                        {initials}
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">+500 contadores</span> ya automatizan con Contilisto
                  </p>
                </div>

                {/* Stat pills */}
                <div className="flex flex-wrap gap-3 mt-6 justify-center lg:justify-start">
                  {[
                    { value: "10x", label: "más rápido", color: "bg-blue-50 text-blue-700" },
                    { value: "90%", label: "menos trabajo manual", color: "bg-green-50 text-green-700" },
                    { value: "100%", label: "compatible SRI", color: "bg-purple-50 text-purple-700" },
                  ].map(({ value, label, color }) => (
                    <div key={value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${color}`}>
                      <span className="font-extrabold">{value}</span>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-gray-500 mt-4">
                  Sin tarjeta de crédito · Plan gratuito disponible · Cancela cuando quieras
                </p>

                {/* Feature highlights */}
                <div className="mt-6 grid grid-cols-2 gap-2 text-sm text-left">
                  {[
                    "✓ Asientos contables automáticos",
                    "✓ Declaraciones IVA con un clic",
                    "✓ Conciliación bancaria inteligente",
                    "✓ Reportes SRI en tiempo real",
                    "✓ Multi-empresa desde una cuenta",
                    "✓ Plan único de cuentas Ecuador",
                  ].map((f) => (
                    <p key={f} className="text-gray-600">{f}</p>
                  ))}
                </div>

                {/* CTA — Mobile */}
                <div className="md:hidden mt-7 space-y-3">
                  <button
                    onClick={openDemo}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl text-base font-semibold"
                  >
                    <PlayCircleIcon className="w-5 h-5" />
                    Ver Demo
                  </button>
                  <button
                    onClick={openLogin}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl text-base font-semibold"
                  >
                    Iniciar sesión
                  </button>
                  <button
                    onClick={scrollToEstudianteCard}
                    className="block w-full py-3 text-center bg-green-500 hover:bg-green-600 text-white rounded-xl text-base font-semibold shadow-md"
                  >
                    Crear cuenta gratis
                  </button>
                  <p className="text-sm text-gray-500 text-center">
                    Sin tarjeta de crédito. Plan Estudiante gratuito.
                  </p>
                </div>
              </div>

              {/* MOCKUP — browser frame (Edwin Franco / datos reales) */}
              <div className="rounded-2xl shadow-2xl overflow-hidden border border-gray-200 lg:scale-105">
                {/* Browser chrome */}
                <div className="bg-gray-100 border-b px-4 py-2.5 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-400 border">
                    app.contilisto.com/dashboard
                  </div>
                </div>

                {/* App shell */}
                <div className="flex h-72 lg:h-96">
                  {/* Sidebar */}
                  <div className="w-28 bg-[#0A3558] text-white p-3 flex flex-col gap-1 text-xs shrink-0">
                    <p className="font-extrabold text-sm mb-1 px-1 tracking-wide">CONTILISTO</p>
                    {/* Entity selector */}
                    <div className="bg-white/10 rounded-lg px-2 py-1.5 mb-2">
                      <p className="font-semibold text-white leading-tight text-[10px] blur-sm select-none">Edwin Franco</p>
                      <p className="text-[9px] text-blue-300 leading-tight blur-sm select-none">0925956237001</p>
                    </div>
                    {[
                      { label: "Dashboard",    active: true  },
                      { label: "Cartera",      active: false },
                      { label: "Contabilidad", active: false },
                      { label: "Bancos",       active: false },
                      { label: "Impuestos",    active: false },
                    ].map(({ label, active }) => (
                      <div
                        key={label}
                        className={`px-2 py-1.5 rounded-lg text-[10px] ${active ? "bg-blue-700 font-semibold" : "text-blue-200"}`}
                      >
                        {label}
                      </div>
                    ))}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 bg-gray-50 p-2.5 overflow-hidden flex flex-col gap-2.5">

                    {/* KPI cards — 5-column like real dashboard */}
                    <div className="grid grid-cols-5 gap-1.5">
                      <div className="bg-white rounded-lg p-2 shadow-sm border">
                        <p className="text-[9px] text-gray-500">Ingresos</p>
                        <p className="text-xs font-bold text-green-600">$750,00</p>
                        <p className="text-[9px] text-green-500">↑ activo</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 shadow-sm border">
                        <p className="text-[9px] text-gray-500">Gastos</p>
                        <p className="text-xs font-bold text-red-500">$99,00</p>
                        <p className="text-[9px] text-red-400">registrado</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 shadow-sm border">
                        <p className="text-[9px] text-gray-500">Utilidad</p>
                        <p className="text-xs font-bold text-blue-700">$651,00</p>
                        <p className="text-[9px] text-blue-400">↑ neta</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 shadow-sm border">
                        <p className="text-[9px] text-gray-500">CxC</p>
                        <p className="text-xs font-bold text-amber-600">$742,00</p>
                        <p className="text-[9px] text-amber-500">por cobrar</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 shadow-sm border">
                        <p className="text-[9px] text-gray-500">CxP</p>
                        <p className="text-xs font-bold text-purple-600">$76,00</p>
                        <p className="text-[9px] text-purple-400">por pagar</p>
                      </div>
                    </div>

                    {/* Mini bar chart — real monthly data (Sep 25–Abr 26, normalized) */}
                    <div className="bg-white rounded-xl p-2.5 shadow-sm border flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold text-gray-700">Ingresos vs Gastos</p>
                        <p className="text-[9px] text-gray-400">Sep 2025 – Abr 2026</p>
                      </div>
                      {/* Bars grow from bottom; container is flex-1 so it expands */}
                      <div className="flex items-end gap-1.5 flex-1 min-h-0">
                        {/* Real data normalized to container height via flex proportions.
                            inc raw: [0,600,150,0,0,0] → scale /600 * 100
                            exp raw: [21,0,0,78,0,0]   → scale /78 * 80 (cap lower so inc dominates) */}
                        {[
                          { inc: 2,   exp: 27, label: "Sep" },
                          { inc: 100, exp: 2,  label: "Oct" },
                          { inc: 25,  exp: 2,  label: "Nov" },
                          { inc: 2,   exp: 80, label: "Dic" },
                          { inc: 2,   exp: 2,  label: "Ene" },
                          { inc: 2,   exp: 2,  label: "Abr" },
                        ].map((d, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
                            <div className="w-full flex items-end gap-0.5 justify-center" style={{ height: "100%" }}>
                              <div
                                className="flex-1 bg-emerald-400 rounded-t transition-all"
                                style={{ height: `${d.inc}%`, minHeight: d.inc > 2 ? 4 : 2 }}
                              />
                              <div
                                className="flex-1 bg-rose-300 rounded-t transition-all"
                                style={{ height: `${d.exp}%`, minHeight: d.exp > 2 ? 4 : 2 }}
                              />
                            </div>
                            <p className="text-[8px] text-gray-400 mt-0.5">{d.label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3 mt-1.5 text-[9px] text-gray-400">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Ingresos
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-300 inline-block" />Gastos
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Status bar */}
                <div className="bg-blue-700 px-4 py-2 flex items-center justify-between text-xs text-white/80">
                  <span>✓ 28 asientos · CxC $742 · IVA 15%</span>
                  <span className="animate-pulse text-white font-semibold">● IA activa</span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ================================================================
         * TRUST SIGNALS
         * ============================================================== */}
        <div className="border-y border-gray-100 bg-gray-50">
          <div className="max-w-5xl mx-auto px-6 py-5">
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-green-500 font-bold">✓</span>
                <span>100% compatible con SRI Ecuador</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500 font-bold">✓</span>
                <span>Datos encriptados y seguros</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500 font-bold">✓</span>
                <span>Sin permanencia — cancela cuando quieras</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500 font-bold">✓</span>
                <span>Soporte en español</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500 font-bold">✓</span>
                <span>Plan gratuito disponible</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================
         * DEMO VIDEO SECTION — first-timer CTA
         * ============================================================== */}
        <section className="bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 py-8 sm:py-14 md:py-16">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <p className="text-blue-400 font-semibold text-sm uppercase tracking-widest mb-3">
              Mira cómo funciona
            </p>
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
              ¿Primera vez aquí? Ve el demo en 2 minutos
            </h2>
            <p className="text-gray-400 mb-10 text-base sm:text-lg max-w-2xl mx-auto">
              Desde subir una factura hasta generar el asiento contable automáticamente — todo en un solo clip.
            </p>

            {/* Video thumbnail / play button */}
            <button
              onClick={openDemo}
              className="group relative inline-block w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-white/10 focus:outline-none"
              aria-label="Ver demo de Contilisto"
            >
              {/* Fake video thumbnail background */}
              <div className="w-full aspect-video bg-gradient-to-br from-blue-900 to-gray-900 flex flex-col items-center justify-center">
                {/* Mini mockup inside the thumbnail */}
                <div className="w-4/5 max-w-md rounded-lg overflow-hidden border border-white/20 shadow-xl mb-4 opacity-60 group-hover:opacity-80 transition-opacity">
                  <div className="bg-gray-800 px-3 py-1.5 flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <div className="w-2 h-2 rounded-full bg-yellow-400" />
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                    </div>
                    <div className="flex-1 bg-white/10 rounded px-2 py-0.5 text-xs text-gray-400">
                      contilisto.com/contabilidad
                    </div>
                  </div>
                  <div className="bg-gray-900 p-3 grid grid-cols-3 gap-2">
                    <div className="bg-white/10 rounded-lg p-2">
                      <p className="text-xs text-gray-400">Ingresos</p>
                      <p className="text-sm font-bold text-green-400">$750,00</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-2">
                      <p className="text-xs text-gray-400">Gastos</p>
                      <p className="text-sm font-bold text-red-400">$99,00</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-2">
                      <p className="text-xs text-gray-400">Utilidad</p>
                      <p className="text-sm font-bold text-blue-400">$651,00</p>
                    </div>
                  </div>
                </div>

                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-white/90 group-hover:bg-white group-hover:scale-110 transition-all duration-200 flex items-center justify-center shadow-2xl">
                    <PlayCircleIcon className="w-14 h-14 text-blue-700" />
                  </div>
                </div>
              </div>

              {/* Bottom label */}
              <div className="bg-black/60 backdrop-blur-sm px-6 py-3 flex items-center justify-between text-sm">
                <span className="text-white font-semibold">Demo de Contilisto</span>
                <span className="text-gray-400">1:30 min · Sin registro</span>
              </div>
            </button>

            <p className="mt-6 text-gray-500 text-sm">
              Después del demo,{" "}
              <button onClick={scrollToPricing} className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                crea tu cuenta gratis
              </button>{" "}
              — sin tarjeta de crédito.
            </p>
          </div>
        </section>

        {/* ================================================================
         * HOW IT WORKS
         * ============================================================== */}
        <section id="como-funciona" className="py-8 sm:py-14 md:py-20">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h2 className="text-2xl md:text-4xl font-bold mb-4">
              Cómo funciona Contilisto
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-8 sm:mb-12 text-sm sm:text-base">
              Automatiza el proceso contable en segundos.
              Solo sube tu factura y la inteligencia artificial hace el resto.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 sm:gap-6 items-center">
              <div className="p-4 sm:p-6 rounded-xl border bg-white shadow-sm hover:shadow-md transition text-center">
                <div className="text-blue-600 text-2xl sm:text-3xl font-bold mb-2 sm:mb-3">1</div>
                <h3 className="font-semibold text-base sm:text-lg mb-1 sm:mb-2">📄 Subes la factura</h3>
                <p className="text-gray-600 text-xs sm:text-sm">Arrastra tu factura PDF o XML al sistema.</p>
              </div>
              <div className="hidden md:flex items-center justify-center text-gray-300 text-3xl">→</div>
              <div className="p-4 sm:p-6 rounded-xl border bg-white shadow-sm hover:shadow-md transition text-center">
                <div className="text-blue-600 text-2xl sm:text-3xl font-bold mb-2 sm:mb-3">2</div>
                <h3 className="font-semibold text-base sm:text-lg mb-1 sm:mb-2">🤖 La IA analiza</h3>
                <p className="text-gray-600 text-xs sm:text-sm">Contilisto identifica proveedor, impuestos y cuentas contables.</p>
              </div>
              <div className="hidden md:flex items-center justify-center text-gray-300 text-3xl">→</div>
              <div className="p-4 sm:p-6 rounded-xl border bg-white shadow-sm hover:shadow-md transition text-center">
                <div className="text-blue-600 text-2xl sm:text-3xl font-bold mb-2 sm:mb-3">3</div>
                <h3 className="font-semibold text-base sm:text-lg mb-1 sm:mb-2">📊 Asiento generado</h3>
                <p className="text-gray-600 text-xs sm:text-sm">El asiento contable se crea automáticamente según el PUC.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-gray-100" />

        {/* ================================================================
         * BENEFICIOS
         * ============================================================== */}
        <section id="beneficios" className="bg-gray-50 py-8 sm:py-14 md:py-20">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl md:text-4xl font-bold text-center mb-4">
              Funciones diseñadas para contadores
            </h2>
            <p className="text-gray-600 text-center max-w-2xl mx-auto mb-8 sm:mb-14 text-sm sm:text-base">
              Todo lo que necesitas para automatizar tu contabilidad,
              desde generación de asientos hasta conciliación bancaria.
            </p>
            <FeatureCards />
          </div>
        </section>

        {/* ================================================================
         * PRECIOS
         * ============================================================== */}
        <section id="precios" className="py-8 sm:py-16 md:py-20">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl md:text-4xl font-bold text-center mb-4">
              Planes diseñados para contadores
            </h2>
            <p className="text-gray-600 text-center mb-2 text-sm sm:text-base">
              Automatiza tu contabilidad y ahorra horas de trabajo cada semana.
            </p>
            <p className="text-gray-600 text-center mb-8 sm:mb-14 text-sm sm:text-base">
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

        {/* ================================================================
         * FAQ
         * ============================================================== */}
        <section id="faq" className="py-8 sm:py-16 md:py-20 bg-gray-50">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-2xl md:text-4xl font-bold text-center mb-3">
              Preguntas frecuentes
            </h2>
            <p className="text-gray-600 text-center mb-10">
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

      {/* ================================================================
       * DEMO MODAL
       * ============================================================== */}
      {showDemo && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center sm:bg-black/80 sm:p-4 cursor-pointer"
          onClick={closeDemo}
        >
          {/* Mobile: full-width 16:9 box. Desktop: 90vw×80vh 16:9 box */}
          <div
            className="w-full sm:w-[90vw] sm:h-[80vh] sm:max-w-6xl bg-black sm:rounded-xl overflow-hidden relative"
            style={{ aspectRatio: isMobile ? "9/16" : "16/9" }}
            onClick={(e) => e.stopPropagation()}
          >
            <video
              key={isMobile ? "mobile" : "desktop"}
              autoPlay
              controls
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            >
              <source
                src={isMobile
                  ? "/videos/contilisto_promo_female_mobile.mp4"
                  : "/videos/contilisto_promo_female_desktop.mp4"}
                type="video/mp4"
              />
            </video>

            {/* CTA button — bottom-right, below the video caption area */}
            <button
              onClick={() => { closeDemo(); scrollToPricing(); }}
              className="absolute bottom-[17px] sm:bottom-[106px] right-[29px] sm:right-6 z-50 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm sm:text-base px-5 py-2.5 sm:px-6 sm:py-3 rounded-full shadow-lg transition whitespace-nowrap opacity-90 hover:opacity-100"
            >
              🚀 Empezar gratis →
            </button>

            {/* Close button */}
            <button
              onClick={closeDemo}
              className="absolute top-4 right-4 z-50 bg-black/60 backdrop-blur-md hover:bg-black/80 text-white text-lg w-9 h-9 rounded-full flex items-center justify-center transition"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      <LoginModal isOpen={loginOpen} onClose={closeLogin} />

      {/* BOTTOM CTA BANNER */}
      <section className="py-10 sm:py-20 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-center px-6">
        <h2 className="text-3xl font-bold mb-4">
          Empieza a usar Contilisto hoy
        </h2>
        <p className="mb-8 opacity-90 text-lg">
          Automatiza tu contabilidad en minutos. Sin tarjeta de crédito.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={scrollToPricing}
            className="bg-white text-blue-600 px-8 py-3 rounded-xl font-semibold hover:bg-blue-50 transition"
          >
            Crear Cuenta Gratis
          </button>
          <button
            onClick={openDemo}
            className="flex items-center gap-2 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold border border-white/30 transition"
          >
            <PlayCircleIcon className="w-5 h-5" />
            Ver Demo primero
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
