// src/pages/TrialPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser } from "@/services/authService";

const FEATURES = [
  { icon: "🤖", text: "Registro de facturas con IA en segundos" },
  { icon: "📊", text: "Estados financieros automáticos" },
  { icon: "🇪🇨", text: "Declaraciones SRI y ATS integradas" },
  { icon: "🏦", text: "Libro bancos y conciliación" },
];

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    "auth/email-already-in-use":   "Este correo ya tiene una cuenta. Inicia sesión.",
    "auth/invalid-email":          "El correo electrónico no es válido.",
    "auth/weak-password":          "La contraseña debe tener al menos 6 caracteres.",
    "auth/network-request-failed": "Sin conexión a internet. Verifica tu red e intenta de nuevo.",
    "auth/too-many-requests":      "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
  };
  return map[code] ?? "Ocurrió un error. Intenta de nuevo.";
}

export default function TrialPage() {
  const navigate = useNavigate();

  const [fullName, setFullName]   = useState("");
  const [email, setEmail]         = useState("");
  const [phone, setPhone]         = useState("");
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await registerUser({ fullName, email, password, phone, company: "", planKey: "estudiante" });
      
      // Meta Pixel: solo se dispara cuando el registro fue exitoso
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "CompleteRegistration", {
          content_name: "Plan Estudiante",
          value: 0,
          currency: "USD",
        });
      }
      
      navigate("/verify-email", { state: { email }, replace: true });
    } catch (err: any) {
      setError(friendlyError(err?.code ?? ""));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── MOBILE TOP BAR (hidden on md+) ─────────────────────────── */}
      <div className="md:hidden bg-gradient-to-r from-blue-700 to-blue-800 px-6 py-4 text-white flex items-center justify-between">
        <div>
          <a href="https://contilisto.com" className="text-xl font-bold tracking-tight">
            Contilisto
          </a>
          <p className="text-blue-200 text-xs mt-0.5">Contabilidad automatizada para Ecuador</p>
        </div>
        <span className="bg-green-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
          🌱 Gratis
        </span>
      </div>

      {/* ── LEFT PANEL (hidden on mobile) ──────────────────────────── */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-blue-700 to-blue-900 flex-col justify-between px-10 py-12 text-white">

        {/* Brand */}
        <div>
          <a href="https://contilisto.com" className="text-3xl font-bold tracking-tight">
            Contilisto
          </a>
          <p className="text-blue-200 text-sm mt-1">Contabilidad automatizada para Ecuador</p>
        </div>

        {/* Hero copy */}
        <div className="my-10">
          <div className="inline-block bg-white/15 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4 tracking-wide uppercase">
            Plan Estudiante · Gratis para siempre
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Tu contabilidad,<br />en piloto automático.
          </h1>
          <p className="text-blue-200 text-base leading-relaxed">
            Sube una factura PDF y Contilisto genera el asiento contable, actualiza tus estados financieros y prepara tus declaraciones al SRI — todo en segundos.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-3 mb-10">
          {FEATURES.map((f) => (
            <div key={f.text} className="flex items-center gap-3">
              <span className="text-xl">{f.icon}</span>
              <span className="text-sm text-blue-100">{f.text}</span>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div className="border-t border-white/20 pt-6">
          <p className="text-blue-200 text-xs mb-3">Contadores y empresas en Ecuador confían en Contilisto</p>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {["EC","JA","DM","NB"].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-white/20 border-2 border-blue-700 flex items-center justify-center text-xs font-bold">
                  {i}
                </div>
              ))}
            </div>
            <span className="text-blue-200 text-xs">+200 usuarios activos</span>
          </div>
        </div>

      </div>

      {/* ── FORM PANEL ─────────────────────────────────────────────── */}
      <div className="flex-1 md:w-1/2 bg-slate-50 flex items-start md:items-center justify-center px-6 py-6 md:px-8 md:py-12">
        <div className="w-full max-w-sm">

          <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-0.5">Crea tu cuenta gratis</h2>
          <p className="text-slate-500 text-xs md:text-sm mb-4">Sin tarjeta de crédito · Listo en 2 minutos</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5 mb-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre completo *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Juan Pérez"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Correo electrónico *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="juan@empresa.com"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Teléfono <span className="font-normal">(opcional)</span></label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0999 000 000"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Contraseña *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2.5 rounded-lg disabled:opacity-60 transition-colors mt-1 shadow-sm"
            >
              {submitting ? "Creando cuenta..." : "Crear cuenta gratis →"}
            </button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-3">
            Al registrarte aceptas nuestros{" "}
            <a href="https://contilisto.com/terminos" className="underline hover:text-slate-600">Términos de uso</a>
            {" "}y{" "}
            <a href="https://contilisto.com/privacidad" className="underline hover:text-slate-600">Política de privacidad</a>.
          </p>

          <div className="border-t border-slate-200 mt-4 pt-3 text-center">
            <p className="text-sm text-slate-500">
              ¿Ya tienes cuenta?{" "}
              <a href="/login" className="text-blue-600 font-semibold hover:underline">
                Inicia sesión
              </a>
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
