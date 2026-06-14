// src/pages/Register.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { registerUser } from "@/services/authService";

const fbq = (...args: any[]) => {
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq(...args);
  }
};

type PlanKey = "starter" | "pro" | "enterprise";

const PLAN_INFO: Record<PlanKey, { label: string; price: number | null; cta: string }> = {
  starter:     { label: "Plan Estudiantil", price: 0.00, cta: "Suscribirse" },
  pro:         { label: "Plan Profesional", price: 29.99, cta: "Suscribirse" },
  enterprise:  { label: "Plan Corporativo", price: 69.99, cta: "Suscribirse" },
};

export default function Register() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [company, setCompany]   = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  const planKey = useMemo<PlanKey>(() => {
    const fromQuery = params.get("plan") as PlanKey | null;
    const fromStorage = sessionStorage.getItem("selectedPlan") as PlanKey | null;
    return fromQuery ?? fromStorage ?? "pro";
  }, [params]);

  useEffect(() => {
    sessionStorage.setItem("selectedPlan", planKey);
    fbq("track", "Lead");
  }, [planKey]);

  const plan = PLAN_INFO[planKey];
  const priceText = plan.price != null ? `$${plan.price}/mes` : "Precio personalizado";
  const ctaText   = plan.price != null ? `${plan.cta} por ${priceText}` : plan.cta;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await registerUser({
        fullName,
        email,
        password,
        phone: "",
        company,
        planKey,
      });
      fbq("track", "CompleteRegistration");
      navigate("/verify-email", { state: { email } });
    } catch (err: any) {
      setError(err?.message || "Error de registro");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[70vh] bg-slate-50 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full max-w-xl rounded-2xl shadow p-8"
      >
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Regístrate en Contilisto</h1>
        <p className="text-sm text-slate-600 mb-6">
          Estás eligiendo: <span className="font-semibold">{plan.label}</span> — {priceText}
        </p>

        {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

        <input
          className="w-full border rounded-lg px-3 py-2 mb-3"
          placeholder="Nombre completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <input
          className="w-full border rounded-lg px-3 py-2 mb-3"
          placeholder="Correo electrónico"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border rounded-lg px-3 py-2 mb-3"
          placeholder="Nombre de empresa"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          required
        />
        <input
          className="w-full border rounded-lg px-3 py-2 mb-4"
          placeholder="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Registrando..." : ctaText}
        </button>
      </form>
    </div>
  );
}
