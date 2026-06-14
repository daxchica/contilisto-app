// src/pages/VerifyEmailPage.tsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "@/firebase-config";
import { useAuth } from "@/context/AuthContext";

export default function VerifyEmailPage() {
  const { user, refreshEmailVerified, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const email = (location.state as any)?.email ?? user?.email ?? "";

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const handleResend = async () => {
    setError("");
    setResending(true);
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error("Sesión no encontrada");
      await sendEmailVerification(firebaseUser);
      setResent(true);
    } catch (err: any) {
      setError(err.message ?? "Error al reenviar el correo");
    } finally {
      setResending(false);
    }
  };

  const handleContinue = async () => {
    setError("");
    setChecking(true);
    try {
      await refreshEmailVerified();
      const firebaseUser = auth.currentUser;
      if (firebaseUser?.emailVerified) {
        navigate("/empresas", { replace: true });
      } else {
        setError("Tu correo aún no está verificado. Revisa tu bandeja de entrada.");
      }
    } catch (err: any) {
      setError(err.message ?? "Error al verificar");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">📧</div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Verifica tu correo electrónico
        </h1>

        <p className="text-slate-600 mb-6 text-sm leading-relaxed">
          Te enviamos un enlace de verificación a{" "}
          <span className="font-semibold text-slate-800">{email}</span>.
          Haz clic en el enlace del correo y luego presiona el botón de abajo.
        </p>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {resent && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
            Correo reenviado. Revisa tu bandeja de entrada.
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={checking}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-60 mb-3"
        >
          {checking ? "Verificando..." : "Ya verifiqué mi correo →"}
        </button>

        <button
          onClick={handleResend}
          disabled={resending}
          className="w-full bg-slate-100 text-slate-700 font-medium py-3 rounded-lg hover:bg-slate-200 disabled:opacity-60 mb-6"
        >
          {resending ? "Reenviando..." : "Reenviar correo de verificación"}
        </button>

        <button
          onClick={logout}
          className="text-sm text-slate-400 hover:text-slate-600 underline"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
