// src/pages/Landing.tsx
import { useState } from "react";
import LoginModal from "../components/LoginModal";
import RegisterModal from "../components/RegisterModal";

export default function Landing() {
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-800 via-blue-700 to-blue-900 text-white flex flex-col items-center justify-center px-6">
      <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center">
        Bienvenido a Contilisto
      </h1>
      <p className="text-lg md:text-xl max-w-xl text-center mb-8">
        Plataforma inteligente para análisis contable automatizado. Sube tus documentos PDF, genera libros contables automáticamente y gestiona tus entidades con facilidad.
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => setShowLogin(true)}
          className="bg-white text-blue-700 px-6 py-2 rounded-lg font-semibold hover:bg-blue-100 transition"
        >
          Iniciar sesión
        </button>
        <button
          onClick={() => setShowRegister(true)}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-semibold"
        >
          Registrarse
        </button>
      </div>

      {/* Modals */}
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
      <RegisterModal isOpen={showRegister} onClose={() => setShowRegister(false)} />
    </div>
  );
}