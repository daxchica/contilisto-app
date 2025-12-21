// src/components/modals/LoginModal.tsx
import { useState } from "react";
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

  const handleLogin = async () => {
    if (loading) return;

    if (!email || !password) {
      setError("Ingresa email y contraseña");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await signInWithEmailAndPassword(auth, email, password);

      onClose();
      navigate("/dashboard");
    } catch (err: any) {
      if (err?.code === "auth/invalid-credential") {
        setError("Email o contraseña incorrectos");
      } else {
        setError("No se pudo iniciar sesión");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} maxWidthClass="max-w-sm">
      <h2 className="text-lg sm:text-xl font-semibold mb-4 text-gray-900">
        Login
      </h2>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-2 rounded mb-3">
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Ingresando..." : "Sign In"}
        </button>

        {/* opcional: link register */}
        <p className="text-sm text-center text-gray-600 pt-1">
          ¿No tienes cuenta?{" "}
          <a
            href="/register"
            className="text-blue-600 hover:underline font-semibold"
          >
            Regístrate aquí
          </a>
        </p>
      </form>
    </Modal>
  );
}
