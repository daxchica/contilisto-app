// src/pages/Landing.tsx
import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import LoginModal from "../components/LoginModal";
import RegisterModal from "../components/RegisterModal";
import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-800 to-blue-700 text-white px-6 py-10 flex flex-col items-center">
      {/* Hero */}
      <section className="text-center max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Contabilidad automatizada en minutos
        </h1>
        <p className="text-lg md:text-xl mb-6">
          Con Contilisto puedes registrar hasta <strong>10 empresas</strong> y realizar hasta <strong>500 registros contables mensuales</strong> por solo <span className="bg-white text-blue-800 px-2 py-1 rounded font-bold">$29/mes</span>.
        </p>
        <Link
          to="/register"
          className="bg-white text-blue-800 font-semibold px-6 py-3 rounded hover:bg-blue-100 transition"
        >
          Empieza ahora
        </Link>
      </section>

      {/* Beneficios */}
      <section className="mt-16 w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/10 p-6 rounded-xl shadow-md text-center">
          <h3 className="text-xl font-bold mb-2">Sube PDF</h3>
          <p className="text-sm">Sube tus facturas y Comprobantes PDF y déjalo en manos de la IA.</p>
        </div>
        <div className="bg-white/10 p-6 rounded-xl shadow-md text-center">
          <h3 className="text-xl font-bold mb-2">Contabilidad Automática</h3>
          <p className="text-sm">La IA genera los asientos contables con códigos PUC Ecuador y lógica tributaria.</p>
        </div>
        <div className="bg-white/10 p-6 rounded-xl shadow-md text-center">
          <h3 className="text-xl font-bold mb-2">Reportes Financieros</h3>
          <p className="text-sm">Obtén Estado de Resultados, Balance General y conciliaciones.</p>
        </div>
      </section>

      {/* CTA Final */}
      <section className="mt-20 text-center">
        <h2 className="text-2xl font-semibold mb-4">
          ¿Listo para comenzar?
        </h2>
        <Link
          to="/register"
          className="bg-yellow-400 text-blue-900 font-bold px-6 py-3 rounded-lg hover:bg-yellow-300 transition"
        >
          Registrarse por $29/mes
        </Link>
      </section>
    </div>
  );
}