// src/pages/Login.tsx
import { useEffect, useState } from "react";
import { auth } from "../firebase-config";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ✅ Redirección centralizada aquí (NO en AuthContext)
  useEffect(() => {
    if (loading) return;

    // ⛔ IMPORTANT: only redirect if we're actually on /login
    if (location.pathname !== "/login") return;

    if (!user) return;

    if (user.role === "master" || user.role === "admin") {
      navigate("/admin", { replace: true });
    } else {
      navigate("/empresas", { replace: true });
    }
  }, [loading, user, location.pathname, navigate]);

  const handleLogin = async () => {
    setError("");
    setSubmitting(true);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      
    } catch (err: any) {
      setError(err.message ?? "Error al iniciar sesion");
      setSubmitting(false);
    }
  };

  // ✅ Si ya está logueado, mostramos un “redirecting” suave
  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-100">
        <div className="bg-white p-6 rounded shadow-md">
          <p className="text-slate-700">
            {loading ? "Cargando..." : "Ingresando..."}
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-blue-100">
      <div className="bg-white p-6 rounded shadow-md w-96">
        <h2 className="text-2xl mb-4 font-bold">Login</h2>

        {error && <p className="text-red-500 mb-4">{error}</p>}

        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 border rounded mb-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 border rounded mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <button
          onClick={handleLogin}
          disabled={submitting}
          className="w-full bg-blue-600 text-white p-2 rounded disabled:opacity-60"
        >
          {submitting ? "Ingresando..." : "Sign In"}
        </button>

        <p className="text-sm mt-4 text-center">
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="text-blue-600 hover:underline">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
}