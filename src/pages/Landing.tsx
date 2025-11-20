// src/pages/Landing.tsx
import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import LoginModal from "../components/LoginModal";
import RegisterModal from "../components/RegisterModal";
import { Link } from "react-router-dom";
import PricingPlans from "../components/PricingPlans";
import Footer from "../components/Footer";
import FeatureCards from "../components/FeatureCards";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white from-blue-900 via-blue-800 to-blue-700 text-black px-6 py-10 flex flex-col items-center">
      {/* ============================================================
       * NAVBAR SUPERIOR
       * ============================================================ */}
      <header className="w-full border-b bg-white/80 backdrop-blur-md fixed top-0 left-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo / Marca */}
          <Link to="/" className="text-xl font-bold text-blue-900">
            Contilisto
          </Link>

          {/* Botones */}
          <div className="flex gap-4">
            <Link
              to="/login"
              className="px-4 py-2 text-blue-900 font-semibold hover:text-blue-700"
            >
              Iniciar Sesión
            </Link>

            <Link
              to="/register"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Crear Cuenta
            </Link>
          </div>
        </div>
      </header>
      
      
      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-28 max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Contabilidad automatizada en minutos
        </h1>

        <p className="text-lg md:text-xl text-gray-600">
          Sube facturas PDF y la IA genera los asientos contables con PUC Ecuador,
          IVA y conciliaciones básicas en minutos.
        </p>
      </section>

      {/* ============================================================
       * FEATURE CARDS
       * ============================================================ */}
      <section className="mt-4 mb-14">
        <FeatureCards />
      </section>

      {/* ============================================================
       * PRICING / PLANES
       * ============================================================ */}
      <section className="mx-auto mt-6 max-w-6xl px-4 sm:px-6 lg:px-8">
        <PricingPlans />
      </section>

      {/* ============================================================
       * CTA FINAL
       * ============================================================ */}
      <section className="mt-20 text-center mb-16">
        <h2 className="text-2xl font-semibold mb-4">¿Listo para comenzar?</h2>
        <Link
          to="/register"
          className="bg-yellow-400 text-blue-900 font-bold px-6 py-3 rounded-lg hover:bg-yellow-300 transition"
        >
          Crear Cuenta Gratis
        </Link>
      </section>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
        