// src/layouts/MainLayout.tsx
import React from "react";
import NavBar from "../components/NavBar";
import Footer from "../components/Footer";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      {/* Padding para que el contenido no quede debajo del navbar */}
      <main className="flex-1 pt-20 px-4">
        {children}
      </main>

      <Footer />
    </div>
  );
}