// src/pages/AuthActionPage.tsx
// Handles Firebase email action links (verify email, reset password, etc.)
// Firebase Console → Authentication → Templates → Action URL must point here.
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { applyActionCode, verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth } from "@/firebase-config";

type Status = "loading" | "success" | "error";

export default function AuthActionPage() {
  const [params] = useSearchParams();
  const mode     = params.get("mode");
  const oobCode  = params.get("oobCode") ?? "";

  const [status, setStatus]   = useState<Status>("loading");
  const [error, setError]     = useState("");

  // Password reset fields
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting]     = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setError("Enlace inválido o expirado.");
      setStatus("error");
      return;
    }

    if (mode === "verifyEmail") {
      applyActionCode(auth, oobCode)
        .then(() => setStatus("success"))
        .catch((err) => {
          setError(err.message ?? "No se pudo verificar el correo.");
          setStatus("error");
        });
    } else if (mode === "resetPassword") {
      // Just validate the code — actual reset happens on form submit
      verifyPasswordResetCode(auth, oobCode)
        .then(() => setStatus("success"))
        .catch((err) => {
          setError(err.message ?? "El enlace de recuperación no es válido o ha expirado.");
          setStatus("error");
        });
    } else {
      setError("Acción no reconocida.");
      setStatus("error");
    }
  }, [mode, oobCode]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return;
    setResetting(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStatus("success");
    } catch (err: any) {
      setError(err.message ?? "Error al cambiar la contraseña.");
    } finally {
      setResetting(false);
    }
  };

  // ── VERIFY EMAIL ──────────────────────────────────────────────────────────

  if (mode === "verifyEmail") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          {status === "loading" && (
            <>
              <div className="text-4xl mb-4 animate-pulse">📧</div>
              <p className="text-slate-600">Verificando tu correo...</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="text-5xl mb-4">✅</div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                ¡Correo verificado!
              </h1>
              <p className="text-slate-600 mb-6">
                Tu cuenta ha sido activada exitosamente. Ya puedes iniciar sesión en Contilisto.
              </p>
              <a
                href="https://contilisto.com/login"
                className="inline-block bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700"
              >
                Iniciar sesión →
              </a>
              <div className="mt-4">
                <a href="https://contilisto.com" className="text-sm text-slate-400 hover:text-slate-600">
                  Volver a Contilisto.com
                </a>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-5xl mb-4">❌</div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Enlace inválido
              </h1>
              <p className="text-slate-500 text-sm mb-6">{error}</p>
              <a
                href="https://contilisto.com"
                className="inline-block bg-slate-100 text-slate-700 font-medium px-6 py-3 rounded-lg hover:bg-slate-200"
              >
                Volver al inicio
              </a>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── RESET PASSWORD ────────────────────────────────────────────────────────

  if (mode === "resetPassword") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          {status === "loading" && (
            <>
              <div className="text-4xl mb-4 animate-pulse">🔑</div>
              <p className="text-slate-600">Validando enlace...</p>
            </>
          )}

          {status === "success" && resetting === false && !error && (
            <>
              <div className="text-5xl mb-4">🔑</div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Nueva contraseña
              </h1>
              <p className="text-slate-600 mb-6 text-sm">
                Ingresa tu nueva contraseña para Contilisto.
              </p>
              <form onSubmit={handlePasswordReset} className="text-left space-y-3">
                <input
                  type="password"
                  placeholder="Nueva contraseña (mín. 6 caracteres)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={resetting}
                  className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  {resetting ? "Guardando..." : "Cambiar contraseña"}
                </button>
              </form>
            </>
          )}

          {status === "success" && !resetting && error === "" && newPassword && (
            <>
              <div className="text-5xl mb-4">✅</div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                ¡Contraseña actualizada!
              </h1>
              <p className="text-slate-600 mb-6">
                Tu contraseña ha sido cambiada exitosamente.
              </p>
              <a
                href="https://contilisto.com/login"
                className="inline-block bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700"
              >
                Iniciar sesión →
              </a>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-5xl mb-4">❌</div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Enlace inválido</h1>
              <p className="text-slate-500 text-sm mb-6">{error}</p>
              <a
                href="https://contilisto.com"
                className="inline-block bg-slate-100 text-slate-700 font-medium px-6 py-3 rounded-lg hover:bg-slate-200"
              >
                Volver al inicio
              </a>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── UNKNOWN MODE ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">❌</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Enlace inválido</h1>
        <p className="text-slate-500 text-sm mb-6">{error || "Acción no reconocida."}</p>
        <a
          href="https://contilisto.com"
          className="inline-block bg-slate-100 text-slate-700 font-medium px-6 py-3 rounded-lg hover:bg-slate-200"
        >
          Volver al inicio
        </a>
      </div>
    </div>
  );
}
