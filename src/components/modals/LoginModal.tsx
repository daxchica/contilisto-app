// ============================================================================
// src/components/modals/LoginModal.tsx
// Modal de inicio de sesión — versión producción
// ============================================================================
import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase-config";
import { useNavigate } from "react-router-dom";
import Modal from "@/components/Modal";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* ============================================================
     Reset state when modal opens / closes
  ============================================================ */
  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setPassword("");
      setError("");
      setLoading(false);
    }
  }, [isOpen]);

  /* ============================================================
     Close on ESC
  ============================================================ */
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  /* ============================================================
     Handlers
  ============================================================ */
  const handleLogin = async () => {
    if (loading) return;

    if (!email || !password) {
      setError("Ingresa tu email y contraseña");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await signInWithEmailAndPassword(auth, email, password);

      onClose();
      navigate("/dashboard");
    } catch (err: any) {
      switch (err?.code) {
        case "auth/invalid-credential":
        case "auth/user-not-found":
        case "auth/wrong-password":
          setError("Email o contraseña incorrectos");
          break;
        case "auth/too-many-requests":
          setError("Demasiados intentos. Intenta más tarde.");
          break;
        default:
          setError("No se pudo iniciar sesión. Intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const goToRegister = () => {
    onClose();
    navigate("/register");
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} maxWidthClass="max-w-sm">
      <h2 className="text-lg sm:text-xl font-semibold mb-4 text-gray-900">
        Iniciar sesión
      </h2>

      {error && (
        <div
          role="alert"
          className="bg-red-50 text-red-600 text-sm p-2 rounded mb-3"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
        className="space-y-3"
      >
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          autoFocus
          disabled={loading}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-11 px-3 border rounded-lg text-black
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     disabled:bg-gray-100"
        />

        <input
          type="password"
          placeholder="Contraseña"
          autoComplete="current-password"
          disabled={loading}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-11 px-3 border rounded-lg text-black
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     disabled:bg-gray-100"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-blue-600 hover:bg-blue-700
                     text-white py-2 rounded-lg font-semibold
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>

        <p className="text-sm text-center text-gray-600 pt-1">
          ¿No tienes cuenta?{" "}
          <button
            type="button"
            onClick={goToRegister}
            className="text-blue-600 hover:underline font-semibold"
          >
            Regístrate aquí
          </button>
        </p>
      </form>
    </Modal>
  );
}