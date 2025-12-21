// ============================================================================
// src/pages/Landing.tsx
// Landing Page profesional para Contilisto.com
// Inspirado en QuickBooks / Xero / Pilot (IA contable).
// ============================================================================
import { Link } from "react-router-dom";
import { useState } from "react";
import PricingPlans from "../components/PricingPlans";
import Footer from "../components/footer/Footer";
import FeatureCards from "../components/FeatureCards";

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* ============================================================
       * NAVBAR SUPERIOR
       * ============================================================ */}
    <header className="fixed top-0 left-0 w-full z-30 bg-white/80 backdrop-blur-lg border-b">
      <div className="max-w-7xl mx-auto px-6 sm:px-6">
        <div className="h-16 flex items-center justify-between">

          {/* Logo / Marca */}
          <Link
            to="/"
            className="text-2xl font-extrabold tracking-tight text-blue-900"
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

            <div className="h-6 w-px bg-gray-300 hidden sm:block" />

            <Link
              to="/login"
              className="text-blue-900 hover:text-blue-700"
            >
              Iniciar sesión
            </Link>

            <Link
              to="/register"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Crear cuenta
            </Link>
          </nav>

          {/* Mobile Menu Button */}
            <button
              className="md:hidden text-2xl text-blue-900"
              aria-label="Abrir menú"
              onClick={() => setMobileOpen(v => !v)}
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
                <Link to="/login">Iniciar sesión</Link>
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

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 pt-20 md:pt-24">
        {/* ============================================================
         * HERO — estilo SaaS moderno
         * ============================================================ */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-blue-50 via-white to-white" />

          <div className="relative max-w-7xl mx-auto px-6 py-16 lg:py-24 flex flex-col lg:flex-row items-center gap-12">
            {/* Texto hero */}
            <div className="flex-1 text-center lg:text-left">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold mb-4 border border-green-100">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Impulsado por Inteligencia Artificial
              </span>

              <h1 className="text-4xl md:text-6xl lg:text-6xl font-extrabold leading-tight text-gray-900 text-balance">
                Contabilidad más rápida. Más precisa.
                <span className="block text-blue-700">
                  Totalmente automatizada con IA.
                </span>
              </h1>

              <p className="mt-6 text-lg md:text-xl text-gray-600 max-w-xl mx-auto lg:mx-0">
                La plataforma contable más moderna para Ecuador. Sube tus
                facturas y deja que la IA genere asientos contables con PUC
                Ecuador, IVA, conciliaciones bancarias y reportes SRI — en
                minutos.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  to="/register"
                  className="px-8 py-3 bg-blue-600 text-white rounded-xl text-lg font-semibold hover:bg-blue-700 shadow-md transition"
                >
                  Crear Cuenta Gratis
                </Link>

                <Link
                  to="/login"
                  className="px-8 py-3 bg-white border border-gray-200 text-gray-800 rounded-xl text-lg font-semibold hover:bg-gray-50 transition"
                >
                  Ver demostración
                </Link>
              </div>

              <p className="mt-4 text-sm text-gray-500">
                Sin tarjeta de crédito. Prueba gratuita del Plan Estudiante.
              </p>
            </div>

            {/* Mockup / resumen visual */}
            <div className="flex-1 w-full">
              <div className="mx-auto max-w-md lg:max-w-xl bg-white border border-blue-100 rounded-2xl shadow-xl p-5 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                      Vista rápida
                    </p>
                    <p className="text-sm text-gray-500">
                      Flujo de factura → IA → Asiento contable
                    </p>
                  </div>
                  <span className="px-3 py-1 text-xs rounded-full bg-blue-50 text-blue-700 font-semibold">
                    Demo IA
                  </span>
                </div>

                {/* Representación simplificada del flujo */}
                <div className="grid grid-cols-3 gap-3 items-center text-xs md:text-sm">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="font-semibold text-gray-700 mb-1">
                      PDF Factura
                    </p>
                    <p className="text-gray-500 text-xs mb-2">
                      Proveedor XYZ  
                      <br />
                      Total: $120,50
                    </p>
                    <span className="inline-flex text-[10px] px-2 py-1 rounded-full bg-gray-200 text-gray-700">
                      Subido
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center">
                    <span className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                      IA
                    </span>
                    <span className="mt-2 text-[10px] text-gray-500">
                      Procesando…
                    </span>
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                    <p className="font-semibold text-gray-800 mb-1">
                      Asiento contable
                    </p>
                    <ul className="text-[11px] text-gray-700 space-y-1">
                      <li>110101 Bancos… Debe 120,50</li>
                      <li>401101 Ventas… Haber 107,59</li>
                      <li>212101 IVA 12%… Haber 12,91</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Asientos 100% balanceados · Listos para Libro Diario y ER
                  </p>
                  <span className="text-xs font-semibold text-green-600">
                    10× más rápido que manual
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
         * SECCIÓN: CÓMO FUNCIONA
         * ============================================================ */}
        <section
          id="como-funciona"
          className="max-w-6xl mx-auto px-6 py-16 lg:py-20"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            ¿Cómo funciona Contilisto?
          </h2>
          <p className="text-center text-gray-600 max-w-2xl mx-auto mb-10">
            Diseñado para que tu contabilidad se sostenga sola. Tres pasos
            simples y tu empresa queda al día.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold mb-3">
                1
              </div>
              <h3 className="text-lg font-semibold mb-2">Sube tus facturas</h3>
              <p className="text-gray-600 text-sm">
                PDF, XML o imágenes. La IA lee totales, subtotales, IVA,
                retenciones y el RUC de proveedor o cliente.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold mb-3">
                2
              </div>
              <h3 className="text-lg font-semibold mb-2">
                IA genera los asientos
              </h3>
              <p className="text-gray-600 text-sm">
                Contilisto crea asientos contables 100% balanceados siguiendo el
                PUC de Ecuador y tus políticas contables.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold mb-3">
                3
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Reportes y anexos en minutos
              </h3>
              <p className="text-gray-600 text-sm">
                Estados financieros, Libro Diario, Libro Mayor, conciliación
                bancaria y anexos SRI listos para descargar.
              </p>
            </div>
          </div>
        </section>

        {/* ============================================================
         * SECCIÓN: BENEFICIOS / POR QUÉ ELEGIRNOS
         * ============================================================ */}
        <section
          id="beneficios"
          className="bg-gray-50 border-y border-gray-100"
        >
          <div className="max-w-6xl mx-auto px-6 py-16 lg:py-20">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Mucho más que un sistema contable.
            </h2>
            <p className="text-center text-gray-600 max-w-2xl mx-auto mb-10">
              Es un asistente inteligente para tu empresa. Inspirado en las
              mejores plataformas contables del mundo, adaptado al contexto
              ecuatoriano.
            </p>

            {/* Puedes seguir usando tu componente existente de features */}
            <FeatureCards />
          </div>
        </section>

        {/* ============================================================
         * TESTIMONIOS / PRUEBA SOCIAL
         * ============================================================ */}
        <section className="max-w-6xl mx-auto px-6 py-16 lg:py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Lo que dicen los usuarios de Contilisto
          </h2>
          <p className="text-center text-gray-600 max-w-2xl mx-auto mb-10">
            Estudios contables, emprendedores y empresas en todo Ecuador ya
            están usando Contilisto para automatizar su contabilidad.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-700 mb-4">
                “Procesamos más de 500 facturas al mes con Contilisto. La IA es
                increíblemente precisa. Redujimos casi un 80% del tiempo en
                registros.”
              </p>
              <p className="text-sm font-semibold text-gray-900">
                Estudio Contable Rivera
              </p>
              <p className="text-xs text-gray-500">Quito, Ecuador</p>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-700 mb-4">
                “Antes llevaba mis cuentas en Excel. Ahora solo subo las
                facturas y listo. Mi contador revisa, ajusta y envía los
                reportes al SRI sin estrés.”
              </p>
              <p className="text-sm font-semibold text-gray-900">
                Ana López, Emprendedora
              </p>
              <p className="text-xs text-gray-500">Guayaquil, Ecuador</p>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-700 mb-4">
                “Lo recomiendo a todos mis clientes de pymes. Da una imagen
                moderna y profesional, similar a las plataformas que se usan en
                Estados Unidos.”
              </p>
              <p className="text-sm font-semibold text-gray-900">
                Carlos Paredes, Contador
              </p>
              <p className="text-xs text-gray-500">Cuenca, Ecuador</p>
            </article>
          </div>
        </section>

        {/* ============================================================
         * SECCIÓN: SEGURIDAD / TECNOLOGÍA
         * ============================================================ */}
        <section className="bg-white border-y border-gray-100">
          <div className="max-w-6xl mx-auto px-6 py-14 lg:py-16 flex flex-col md:flex-row gap-10 items-center">
            <div className="flex-1">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                Construido con la tecnología más avanzada.
              </h2>
              <p className="text-gray-600 mb-4">
                Contilisto utiliza IA de última generación, infraestructura en
                la nube y estándares internacionales de seguridad para proteger
                la información financiera de tu empresa.
              </p>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Cifrado de datos en tránsito y en reposo.</li>
                <li>• Autenticación segura con Firebase.</li>
                <li>• Registros contables trazables para auditoría.</li>
                <li>• Arquitectura escalable preparada para miles de usuarios.</li>
              </ul>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-gray-200 p-4 text-center">
                <p className="font-semibold text-gray-800 mb-1">
                  IA de última generación
                </p>
                <p className="text-gray-500">
                  Modelos de lenguaje avanzados adaptados al contexto contable
                  ecuatoriano.
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4 text-center">
                <p className="font-semibold text-gray-800 mb-1">
                  Estándares globales
                </p>
                <p className="text-gray-500">
                  Inspirado en las mejores prácticas de plataformas como
                  QuickBooks, Xero y Pilot.
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4 text-center">
                <p className="font-semibold text-gray-800 mb-1">
                  Infraestructura en la nube
                </p>
                <p className="text-gray-500">
                  Servidores seguros y escalables, listos para crecer con tu
                  empresa.
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4 text-center">
                <p className="font-semibold text-gray-800 mb-1">
                  Soporte humano + IA
                </p>
                <p className="text-gray-500">
                  Combina automatización con el criterio de expertos
                  contables.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
         * PRICING / PLANES
         * ============================================================ */}
        <section
          id="precios"
          className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Planes simples. Resultados extraordinarios.
          </h2>
          <p className="text-center text-gray-600 max-w-2xl mx-auto mb-10">
            Desde emprendedores hasta estudios contables y empresas
            corporativas. Elige el plan que mejor se adapta a tu realidad.
          </p>

          <PricingPlans />
        </section>

        {/* ============================================================
         * CTA FINAL
         * ============================================================ */}
        <section className="bg-blue-50 border-y border-blue-100">
          <div className="max-w-4xl mx-auto px-6 py-14 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-blue-900">
              ¿Listo para dejar la contabilidad manual atrás?
            </h2>
            <p className="text-gray-700 mb-6">
              Crea tu cuenta hoy, sube tus primeras facturas y deja que
              Contilisto haga el trabajo pesado. Tú enfócate en hacer crecer tu
              negocio.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center justify-center bg-blue-600 text-white font-bold px-10 py-4 rounded-xl text-lg hover:bg-blue-700 transition shadow-md"
            >
              Crear Cuenta Gratis
            </Link>
            <p className="mt-3 text-xs text-gray-500">
              Sin contrato a largo plazo. Cancela cuando quieras.
            </p>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}